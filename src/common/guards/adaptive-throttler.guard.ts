import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';

@Injectable()
export class AdaptiveThrottlerGuard extends ThrottlerGuard {
	private readonly adaptiveLogger = new Logger(AdaptiveThrottlerGuard.name);

	protected async handleRequest(
		requestProps: ThrottlerRequest,
	): Promise<boolean> {
		const { context } = requestProps;
		const req = context.switchToHttp().getRequest();

		// Verifica se há indícios de autenticação (JWT Header ou Refresh Cookie)
		// Isso permite uma margem maior para usuários logados
		const hasAuthHeader = !!req.headers.authorization;
		const hasAuthCookie = !!req.cookies?.refreshToken;
		const isAuth = hasAuthHeader || hasAuthCookie;

		if (isAuth) {
			// Multiplica o limite de requisições por 3 para usuários autenticados
			requestProps.limit = requestProps.limit * 3;
		}

		return super.handleRequest(requestProps);
	}
}
