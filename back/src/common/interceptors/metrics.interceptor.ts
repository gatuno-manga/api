import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
	constructor(
		@InjectMetric('http_requests_total')
		private readonly requestCounter: Counter,
		@InjectMetric('http_request_duration_seconds')
		private readonly requestDuration: Histogram,
		@InjectMetric('http_request_size_bytes')
		private readonly requestSize: Histogram,
		@InjectMetric('http_response_size_bytes')
		private readonly responseSize: Histogram,
	) {}

	intercept(
		context: ExecutionContext,
		next: CallHandler,
	): Observable<unknown> {
		const httpContext = context.switchToHttp();
		const request = httpContext.getRequest<Request>();
		const response = httpContext.getResponse<Response>();

		const { method, body } = request as unknown as Record<string, unknown>;
		const routePath =
			(request.route as { path?: string } | undefined)?.path ||
			request.url;
		const startTime = Date.now();

		// Tamanho da requisição
		const reqSize = body ? JSON.stringify(body).length : 0;
		if (reqSize > 0) {
			this.requestSize.observe(
				{
					method,
					route: routePath,
				},
				reqSize,
			);
		}

		return next.handle().pipe(
			tap((data: unknown) => {
				const duration = (Date.now() - startTime) / 1000;
				const { statusCode } = response;

				// Incrementa contador de requisições
				this.requestCounter.inc({
					method,
					route: routePath,
					status: statusCode,
				});

				// Registra duração
				this.requestDuration.observe(
					{
						method,
						route: routePath,
						status: statusCode,
					},
					duration,
				);

				// Tamanho da resposta (com tratamento para referências circulares)
				let resSize = 0;
				try {
					resSize = data ? JSON.stringify(data).length : 0;
				} catch {
					// Ignora erro de referência circular
					resSize = 0;
				}
				if (resSize > 0) {
					this.responseSize.observe(
						{
							method,
							route: routePath,
							status: statusCode,
						},
						resSize,
					);
				}
			}),
			catchError((error: { status?: number }) => {
				const duration = (Date.now() - startTime) / 1000;
				const statusCode = error.status || 500;

				// Incrementa contador mesmo em caso de erro
				this.requestCounter.inc({
					method,
					route: routePath,
					status: statusCode,
				});

				// Registra duração do erro
				this.requestDuration.observe(
					{
						method,
						route: routePath,
						status: statusCode,
					},
					duration,
				);

				return throwError(() => error);
			}),
		);
	}
}
