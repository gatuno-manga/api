import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
	getRequestResponse(context: ExecutionContext) {
		if (context.getType().toString() === 'graphql') {
			const gqlCtx = GqlExecutionContext.create(context);
			const ctx = gqlCtx.getContext();
			return {
				req: ctx.req,
				res: ctx.res,
			};
		}

		const http = context.switchToHttp();
		const req = http.getRequest();
		const res = http.getResponse();

		return {
			req: req || { headers: {}, ip: '127.0.0.1' },
			res: res || { header: () => {} },
		};
	}
}
