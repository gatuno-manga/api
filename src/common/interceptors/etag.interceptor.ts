import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Observable, map } from 'rxjs';

@Injectable()
export class EtagInterceptor implements NestInterceptor {
	intercept(
		context: ExecutionContext,
		next: CallHandler,
	): Observable<unknown> {
		if (context.getType().toString() === 'graphql') {
			return next.handle();
		}

		const request = context.switchToHttp().getRequest();
		const response = context.switchToHttp().getResponse();

		// Apenas aplica ETag em requisições GET de HTTP
		if (request.method !== 'GET') {
			return next.handle();
		}

		return next.handle().pipe(
			map((data) => {
				if (!data) return data;

				// Gera o hash do conteúdo para o ETag
				const entityTag = createHash('md5')
					.update(JSON.stringify(data))
					.digest('hex');
				const etagValue = `"${entityTag}"`;

				response.header('ETag', etagValue);

				// Verifica Cache Condicional
				const ifNoneMatch = request.headers['if-none-match'];
				if (ifNoneMatch === etagValue) {
					response.status(304);
					return; // Retorna vazio para o status 304
				}

				return data;
			}),
		);
	}
}
