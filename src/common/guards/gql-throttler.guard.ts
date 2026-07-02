import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request, Response } from 'express';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
	override getRequestResponse(context: ExecutionContext) {
		if (context.getType().toString() === 'graphql') {
			const gqlCtx = GqlExecutionContext.create(context);
			const ctx = gqlCtx.getContext<{ req: Request; res: Response }>();
			return {
				req: ctx.req,
				res: ctx.res,
			};
		}

		const http = context.switchToHttp();
		const req = http.getRequest<Request>();
		const res = http.getResponse<Response>();

		return {
			req:
				req ||
				({
					headers: {},
					ip: '127.0.0.1',
				} as Partial<Request>),
			res: res || ({ header: () => res } as unknown as Partial<Response>),
		};
	}
}
