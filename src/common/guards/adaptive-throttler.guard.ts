import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';

@Injectable()
export class AdaptiveThrottlerGuard extends ThrottlerGuard {
	private readonly adaptiveLogger = new Logger(AdaptiveThrottlerGuard.name);

	protected async handleRequest(
		requestProps: ThrottlerRequest,
	): Promise<boolean> {
		const { context } = requestProps;
		const req = this.getRequest(context);

		// Verifica se há indícios de autenticação (JWT Header ou Refresh Cookie)
		// Isso permite uma margem maior para usuários logados
		const hasAuthHeader = !!req.headers?.authorization;
		const hasAuthCookie = !!req.cookies?.refreshToken;
		const isAuth = hasAuthHeader || hasAuthCookie;

		if (isAuth) {
			// Multiplica o limite de requisições por 3 para usuários autenticados
			requestProps.limit = requestProps.limit * 3;
		}

		return super.handleRequest(requestProps);
	}

	private getRequest(context: ExecutionContext) {
		if (context.getType().toString() === 'graphql') {
			const gqlCtx = GqlExecutionContext.create(context);
			return gqlCtx.getContext().req;
		}
		return context.switchToHttp().getRequest();
	}

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
