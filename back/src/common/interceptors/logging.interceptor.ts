import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { CustomLogger } from '../../custom.logger';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
	constructor(private readonly logger: CustomLogger) {
		this.logger.setContext('HttpRequest');
	}

	intercept(
		context: ExecutionContext,
		next: CallHandler,
	): Observable<unknown> {
		const httpContext = context.switchToHttp();
		const request = httpContext.getRequest();
		const response = httpContext.getResponse();

		const { method, url, query, params, ip, headers } = request;
		const userAgent = headers['user-agent'] || '';
		const userId = request.user?.id;
		const startTime = Date.now();

		// Log da requisição entrante (apenas em debug)
		this.logger.debug(`Incoming request: ${method} ${url}`, 'HttpRequest');

		return next.handle().pipe(
			tap((data) => {
				const { statusCode } = response;
				const duration = Date.now() - startTime;

				// Log de sucesso
				this.logger.logHttpRequest({
					method,
					url,
					statusCode,
					duration,
					userId,
					ip,
					userAgent,
					metadata: {
						queryParams:
							Object.keys(query).length > 0 ? query : undefined,
						routeParams:
							Object.keys(params).length > 0 ? params : undefined,
						responseSize: data ? JSON.stringify(data).length : 0,
					},
				});

				// Alerta para requisições lentas
				if (duration > 3000) {
					this.logger.warn(
						`Slow request detected: ${method} ${url} took ${duration}ms`,
						'Performance',
					);
				}
			}),
			catchError((error) => {
				const duration = Date.now() - startTime;
				const statusCode = error.status || 500;

				// Log de erro estruturado
				this.logger.logHttpRequest({
					method,
					url,
					statusCode,
					duration,
					userId,
					ip,
					userAgent,
					metadata: {
						errorMessage: error.message,
						errorName: error.name,
						errorStack: error.stack,
						queryParams:
							Object.keys(query).length > 0 ? query : undefined,
						routeParams:
							Object.keys(params).length > 0 ? params : undefined,
					},
				});

				return throwError(() => error);
			}),
		);
	}
}
