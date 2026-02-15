import { CACHE_KEY_METADATA, CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable } from '@nestjs/common';

/**
 * Interceptor de cache sensível ao nível de sensibilidade do usuário.
 *
 * Este interceptor estende o CacheInterceptor padrão do NestJS para incluir
 * o nível de sensibilidade do usuário (maxWeightSensitiveContent) na chave
 * do cache, garantindo que conteúdo adulto não seja servido a menores ou
 * visitantes não autenticados.
 *
 * **Problema Resolvido:**
 * O CacheInterceptor padrão usa apenas a URL como chave, causando que
 * respostas geradas para um adulto sejam servidas a menores, ignorando
 * completamente os filtros de conteúdo sensível.
 *
 * **Estratégia de Cache:**
 * - Usuário autenticado: `{url}:level-{maxWeightSensitiveContent}`
 * - Usuário não autenticado: `{url}:public`
 *
 * Isso garante isolamento entre diferentes níveis de acesso enquanto
 * permite compartilhamento eficiente entre usuários do mesmo nível.
 *
 * @example
 * // Antes (vulnerável):
 * // Adulto acessa /api/books → cache: "/api/books"
 * // Menor acessa /api/books → retorna cache do adulto ❌
 *
 * // Depois (seguro):
 * // Adulto acessa /api/books → cache: "/api/books:level-99"
 * // Menor acessa /api/books → cache: "/api/books:level-4" ✅
 */
@Injectable()
export class UserAwareCacheInterceptor extends CacheInterceptor {
	/**
	 * Gera a chave de cache incluindo o nível de sensibilidade do usuário.
	 *
	 * @param context - Contexto de execução do NestJS
	 * @returns Chave de cache única por URL e nível de sensibilidade, ou undefined se cache estiver desabilitado
	 */
	trackBy(context: ExecutionContext): string | undefined {
		const request = context.switchToHttp().getRequest();
		const httpHandler = context.getHandler();
		const httpClass = context.getClass();

		// Obtém a chave base do cache (usa metadata customizado se definido, senão usa a URL)
		const baseKey =
			this.reflector.get(CACHE_KEY_METADATA, httpHandler) ||
			this.reflector.get(CACHE_KEY_METADATA, httpClass) ||
			request.url;

		// Se não há chave base, cache está desabilitado para este endpoint
		if (!baseKey) {
			return undefined;
		}

		const user = request.user;

		// Inclui o nível de sensibilidade na chave para garantir isolamento
		if (user?.maxWeightSensitiveContent !== undefined) {
			return `${baseKey}:level-${user.maxWeightSensitiveContent}`;
		}

		// Para usuários não autenticados ou sem nível definido, usa sufixo :public
		return `${baseKey}:public`;
	}
}
