import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class DataEnvelopeInterceptor implements NestInterceptor {
	intercept(
		_context: ExecutionContext,
		next: CallHandler,
	): Observable<unknown> {
		return next.handle().pipe(
			map((payload: unknown) => {
				if (
					payload &&
					typeof payload === 'object' &&
					'data' in payload &&
					('meta' in payload ||
						'metadata' in payload ||
						'hasNextPage' in payload)
				) {
					return payload;
				}

				return {
					data: payload,
					meta: null,
					links: null,
				};
			}),
		);
	}
}
