import { CACHE_KEY_METADATA, CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';

interface RequestWithUser {
	url?: string;
	user?: CurrentUserDto | null;
}

@Injectable()
export class UserAwareCacheInterceptor extends CacheInterceptor {
	/**
	 * Gera a chave de cache incluindo o contexto do usuário autenticado.
	 * Suporta HTTP e GraphQL.
	 *
	 * @param context - Contexto de execução do NestJS
	 * @returns Chave de cache única por recurso e contexto do usuário, ou undefined se cache estiver desabilitado
	 */
	trackBy(context: ExecutionContext): string | undefined {
		const contextType = context.getType() as string;

		if (contextType === 'graphql') {
			return this.trackGraphQL(context);
		}

		return this.trackHttp(context);
	}

	private trackHttp(context: ExecutionContext): string | undefined {
		const request = context.switchToHttp().getRequest<RequestWithUser>();
		const resourceKey = this.getResourceKey(context) || request.url;

		if (!resourceKey) {
			return undefined;
		}

		return this.generateCacheKey(resourceKey, request.user);
	}

	private trackGraphQL(context: ExecutionContext): string | undefined {
		const gqlContext = GqlExecutionContext.create(context);
		const info = gqlContext.getInfo();
		const args = gqlContext.getArgs();
		const user = gqlContext.getContext().req?.user as
			| CurrentUserDto
			| undefined;

		const operationName = info.fieldName;
		const argsKey = JSON.stringify(args);
		const resourceKey = `gql:${operationName}:${argsKey}`;

		return this.generateCacheKey(resourceKey, user);
	}

	private getResourceKey(context: ExecutionContext): string | undefined {
		return this.reflector.getAllAndOverride<string>(CACHE_KEY_METADATA, [
			context.getHandler(),
			context.getClass(),
		]);
	}

	private generateCacheKey(
		resourceKey: string,
		user?: CurrentUserDto | null,
	): string {
		if (user?.maxWeightSensitiveContent !== undefined) {
			const userKey = user.userId || 'authenticated';
			return `${resourceKey}:user-${userKey}:level-${user.maxWeightSensitiveContent}`;
		}

		return `${resourceKey}:public`;
	}
}
