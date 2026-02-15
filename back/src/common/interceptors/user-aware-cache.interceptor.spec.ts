import { CACHE_KEY_METADATA } from '@nestjs/cache-manager';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserAwareCacheInterceptor } from './user-aware-cache.interceptor';

describe('UserAwareCacheInterceptor', () => {
	let interceptor: UserAwareCacheInterceptor;
	let reflector: Reflector;
	let mockExecutionContext: ExecutionContext;

	beforeEach(() => {
		reflector = new Reflector();
		interceptor = new UserAwareCacheInterceptor(null, reflector);

		mockExecutionContext = {
			switchToHttp: jest.fn().mockReturnValue({
				getRequest: jest.fn(),
			}),
			getHandler: jest.fn(),
			getClass: jest.fn(),
		} as unknown as ExecutionContext;
	});

	describe('trackBy', () => {
		it('deve criar chave com sufixo :public para usuário não autenticado', () => {
			const mockRequest = {
				url: '/api/books?page=1',
				user: null,
			};

			(
				mockExecutionContext.switchToHttp().getRequest as jest.Mock
			).mockReturnValue(mockRequest);
			jest.spyOn(reflector, 'get').mockReturnValue(undefined);

			const result = interceptor.trackBy(mockExecutionContext);

			expect(result).toBe('/api/books?page=1:public');
		});

		it('deve criar chave com sufixo :public para usuário sem maxWeightSensitiveContent definido', () => {
			const mockRequest = {
				url: '/api/books',
				user: { userId: '123' }, // sem maxWeightSensitiveContent
			};

			(
				mockExecutionContext.switchToHttp().getRequest as jest.Mock
			).mockReturnValue(mockRequest);
			jest.spyOn(reflector, 'get').mockReturnValue(undefined);

			const result = interceptor.trackBy(mockExecutionContext);

			expect(result).toBe('/api/books:public');
		});

		it('deve criar chave com :level-0 para usuário com nível de sensibilidade 0', () => {
			const mockRequest = {
				url: '/api/books',
				user: { userId: '123', maxWeightSensitiveContent: 0 },
			};

			(
				mockExecutionContext.switchToHttp().getRequest as jest.Mock
			).mockReturnValue(mockRequest);
			jest.spyOn(reflector, 'get').mockReturnValue(undefined);

			const result = interceptor.trackBy(mockExecutionContext);

			expect(result).toBe('/api/books:level-0');
		});

		it('deve criar chave com :level-4 para usuário menor (nível 4)', () => {
			const mockRequest = {
				url: '/api/books',
				user: { userId: '123', maxWeightSensitiveContent: 4 },
			};

			(
				mockExecutionContext.switchToHttp().getRequest as jest.Mock
			).mockReturnValue(mockRequest);
			jest.spyOn(reflector, 'get').mockReturnValue(undefined);

			const result = interceptor.trackBy(mockExecutionContext);

			expect(result).toBe('/api/books:level-4');
		});

		it('deve criar chave com :level-99 para usuário adulto (nível 99)', () => {
			const mockRequest = {
				url: '/api/books',
				user: { userId: '123', maxWeightSensitiveContent: 99 },
			};

			(
				mockExecutionContext.switchToHttp().getRequest as jest.Mock
			).mockReturnValue(mockRequest);
			jest.spyOn(reflector, 'get').mockReturnValue(undefined);

			const result = interceptor.trackBy(mockExecutionContext);

			expect(result).toBe('/api/books:level-99');
		});

		it('deve preservar query parameters na chave de cache', () => {
			const mockRequest = {
				url: '/api/books?page=1&take=10&order=ASC',
				user: { userId: '123', maxWeightSensitiveContent: 4 },
			};

			(
				mockExecutionContext.switchToHttp().getRequest as jest.Mock
			).mockReturnValue(mockRequest);
			jest.spyOn(reflector, 'get').mockReturnValue(undefined);

			const result = interceptor.trackBy(mockExecutionContext);

			expect(result).toBe('/api/books?page=1&take=10&order=ASC:level-4');
		});

		it('deve usar CACHE_KEY_METADATA do handler se definido', () => {
			const mockRequest = {
				url: '/api/books',
				user: { userId: '123', maxWeightSensitiveContent: 4 },
			};

			(
				mockExecutionContext.switchToHttp().getRequest as jest.Mock
			).mockReturnValue(mockRequest);
			jest.spyOn(reflector, 'get').mockReturnValueOnce(
				'custom-cache-key',
			);

			const result = interceptor.trackBy(mockExecutionContext);

			expect(result).toBe('custom-cache-key:level-4');
			expect(reflector.get).toHaveBeenCalledWith(
				CACHE_KEY_METADATA,
				mockExecutionContext.getHandler(),
			);
		});

		it('deve usar CACHE_KEY_METADATA da classe se não estiver no handler', () => {
			const mockRequest = {
				url: '/api/books',
				user: { userId: '123', maxWeightSensitiveContent: 4 },
			};

			(
				mockExecutionContext.switchToHttp().getRequest as jest.Mock
			).mockReturnValue(mockRequest);
			jest.spyOn(reflector, 'get')
				.mockReturnValueOnce(undefined) // handler
				.mockReturnValueOnce('class-cache-key'); // class

			const result = interceptor.trackBy(mockExecutionContext);

			expect(result).toBe('class-cache-key:level-4');
		});

		it('deve retornar undefined se não houver chave base', () => {
			const mockRequest = {
				url: null,
				user: { userId: '123', maxWeightSensitiveContent: 4 },
			};

			(
				mockExecutionContext.switchToHttp().getRequest as jest.Mock
			).mockReturnValue(mockRequest);
			jest.spyOn(reflector, 'get').mockReturnValue(undefined);

			const result = interceptor.trackBy(mockExecutionContext);

			expect(result).toBeUndefined();
		});

		it('deve garantir isolamento: diferentes níveis geram chaves diferentes', () => {
			const mockRequestAdulto = {
				url: '/api/books/abc-123',
				user: { userId: '1', maxWeightSensitiveContent: 99 },
			};

			const mockRequestMenor = {
				url: '/api/books/abc-123',
				user: { userId: '2', maxWeightSensitiveContent: 4 },
			};

			const mockRequestPublic = {
				url: '/api/books/abc-123',
				user: null,
			};

			jest.spyOn(reflector, 'get').mockReturnValue(undefined);

			// Simula requisição do adulto
			(
				mockExecutionContext.switchToHttp().getRequest as jest.Mock
			).mockReturnValue(mockRequestAdulto);
			const chaveAdulto = interceptor.trackBy(mockExecutionContext);

			// Simula requisição do menor
			(
				mockExecutionContext.switchToHttp().getRequest as jest.Mock
			).mockReturnValue(mockRequestMenor);
			const chaveMenor = interceptor.trackBy(mockExecutionContext);

			// Simula requisição pública
			(
				mockExecutionContext.switchToHttp().getRequest as jest.Mock
			).mockReturnValue(mockRequestPublic);
			const chavePublic = interceptor.trackBy(mockExecutionContext);

			// Todas devem ser diferentes
			expect(chaveAdulto).toBe('/api/books/abc-123:level-99');
			expect(chaveMenor).toBe('/api/books/abc-123:level-4');
			expect(chavePublic).toBe('/api/books/abc-123:public');
			expect(chaveAdulto).not.toBe(chaveMenor);
			expect(chaveMenor).not.toBe(chavePublic);
			expect(chaveAdulto).not.toBe(chavePublic);
		});

		it('deve permitir compartilhamento: mesmo nível gera mesma chave', () => {
			const mockRequestUsuario1 = {
				url: '/api/books',
				user: { userId: '1', maxWeightSensitiveContent: 4 },
			};

			const mockRequestUsuario2 = {
				url: '/api/books',
				user: { userId: '2', maxWeightSensitiveContent: 4 },
			};

			jest.spyOn(reflector, 'get').mockReturnValue(undefined);

			// Simula requisição do usuário 1
			(
				mockExecutionContext.switchToHttp().getRequest as jest.Mock
			).mockReturnValue(mockRequestUsuario1);
			const chave1 = interceptor.trackBy(mockExecutionContext);

			// Simula requisição do usuário 2
			(
				mockExecutionContext.switchToHttp().getRequest as jest.Mock
			).mockReturnValue(mockRequestUsuario2);
			const chave2 = interceptor.trackBy(mockExecutionContext);

			// Devem ser iguais (compartilham cache)
			expect(chave1).toBe(chave2);
			expect(chave1).toBe('/api/books:level-4');
		});
	});
});
