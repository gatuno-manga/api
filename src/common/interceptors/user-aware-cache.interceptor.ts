import { CACHE_KEY_METADATA, CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';

interface RequestWithUser {
	url?: string;
	user?: CurrentUserDto | null;
}

@Injectable()
export class UserAwareCacheInterceptor extends CacheInterceptor {
	/**
	 * Gera a chave de cache incluindo o contexto do usuário autenticado.
	 *
	 * @param context - Contexto de execução do NestJS
	 * @returns Chave de cache única por URL e contexto do usuário, ou undefined se cache estiver desabilitado
	 */
	trackBy(context: ExecutionContext): string | undefined {
		const request = context.switchToHttp().getRequest<RequestWithUser>();
		const resourceKey = this.getResourceKey(context) || request.url;

		if (!resourceKey) {
			return undefined;
		}

		return this.generateCacheKey(resourceKey, request.user);
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
