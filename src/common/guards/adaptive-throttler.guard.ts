import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';
import { Request, Response } from 'express';

@Injectable()
export class AdaptiveThrottlerGuard extends ThrottlerGuard {
	private readonly adaptiveLogger = new Logger(AdaptiveThrottlerGuard.name);

	protected override async handleRequest(
		requestProps: ThrottlerRequest,
	): Promise<boolean> {
		const { context } = requestProps;
		const req = this.getRequest(context);

		// Verifica se há indícios de autenticação (JWT Header ou Refresh Cookie)
		// Isso permite uma margem maior para usuários logados
		const headers = (req?.headers || {}) as Record<
			string,
			string | undefined
		>;
		const cookies = (req?.cookies || {}) as Record<
			string,
			string | undefined
		>;

		const hasAuthHeader = !!headers.authorization;
		const hasAuthCookie = !!cookies.refreshToken;
		const isAuth = hasAuthHeader || hasAuthCookie;

		if (isAuth) {
			// Multiplica o limite de requisições por 3 para usuários autenticados
			requestProps.limit = requestProps.limit * 3;
		}

		return super.handleRequest(requestProps);
	}

	private getRequest(context: ExecutionContext): Request {
		if (context.getType().toString() === 'graphql') {
			const gqlCtx = GqlExecutionContext.create(context);
			const ctx = gqlCtx.getContext<{ req: Request }>();
			return ctx.req;
		}
		return context.switchToHttp().getRequest<Request>();
	}

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
				} as unknown as Partial<Request>),
			res: res || ({ header: () => {} } as unknown as Partial<Response>),
		};
	}
}
