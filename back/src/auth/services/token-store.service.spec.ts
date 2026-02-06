import { Test, TestingModule } from '@nestjs/testing';
import { TokenStoreService } from './token-store.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AppConfigService } from 'src/app-config/app-config.service';

describe('TokenStoreService', () => {
	let service: TokenStoreService;
	let cacheManager: any;
	let appConfigService: any;

	beforeEach(async () => {
		const mockCacheManager = {
			get: jest.fn(),
			set: jest.fn(),
			del: jest.fn(),
		};

		const mockAppConfigService = {
			refreshTokenTtl: 604800000, // 7 days in ms
			maxSessionsPerUser: 0, // unlimited by default
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TokenStoreService,
				{
					provide: CACHE_MANAGER,
					useValue: mockCacheManager,
				},
				{
					provide: AppConfigService,
					useValue: mockAppConfigService,
				},
			],
		}).compile();

		service = module.get<TokenStoreService>(TokenStoreService);
		cacheManager = module.get(CACHE_MANAGER);
		appConfigService = module.get<AppConfigService>(AppConfigService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('getValidTokens', () => {
		it('should return empty array if no tokens in cache', async () => {
			cacheManager.get.mockResolvedValue(null);
			const result = await service.getValidTokens('user123');
			expect(result).toEqual([]);
		});

		it('should filter out expired tokens', async () => {
			const now = Date.now();
			const tokens = [
				{ hash: 'valid', expiresAt: now + 1000 },
				{ hash: 'expired', expiresAt: now - 1000 },
			];
			cacheManager.get.mockResolvedValue(tokens);

			const result = await service.getValidTokens('user123');
			expect(result).toHaveLength(1);
			expect(result[0].hash).toBe('valid');
		});
	});

	describe('saveTokens', () => {
		it('should delete key if tokens array is empty', async () => {
			await service.saveTokens('user123', []);
			expect(cacheManager.del).toHaveBeenCalled();
		});

		it('should delete key if all tokens are already expired', async () => {
			const now = Date.now();
			const tokens = [
				{ hash: 'expired1', expiresAt: now - 5000 },
				{ hash: 'expired2', expiresAt: now - 1000 },
			];

			await service.saveTokens('user123', tokens);
			expect(cacheManager.del).toHaveBeenCalledWith('user-tokens:user123');
			expect(cacheManager.set).not.toHaveBeenCalled();
		});

		it('should use Math.max TTL — cache lives as long as the longest-lived token', async () => {
			const now = Date.now();
			const tokens = [
				{ hash: 'token_short', expiresAt: now + 5000 },
				{ hash: 'token_long', expiresAt: now + 60000 },
			];

			await service.saveTokens('user123', tokens);

			expect(cacheManager.set).toHaveBeenCalled();
			const [key, savedTokens, ttl] = cacheManager.set.mock.calls[0];
			expect(key).toBe('user-tokens:user123');
			// TTL should be based on the LATEST expiration (Math.max), not the earliest
			expect(ttl).toBeGreaterThan(50000);
			expect(ttl).toBeLessThanOrEqual(60000);
			expect(savedTokens).toHaveLength(2);
		});

		it('should filter out expired tokens before saving', async () => {
			const now = Date.now();
			const tokens = [
				{ hash: 'valid', expiresAt: now + 30000 },
				{ hash: 'expired', expiresAt: now - 1000 },
			];

			await service.saveTokens('user123', tokens);

			const [, savedTokens] = cacheManager.set.mock.calls[0];
			expect(savedTokens).toHaveLength(1);
			expect(savedTokens[0].hash).toBe('valid');
		});
	});

	describe('addToken', () => {
		it('should add a new token and save', async () => {
			cacheManager.get.mockResolvedValue([]);
			await service.addToken('user123', 'new_hash');

			expect(cacheManager.set).toHaveBeenCalled();
			const [, savedTokens] = cacheManager.set.mock.calls[0];
			expect(savedTokens).toHaveLength(1);
			expect(savedTokens[0].hash).toBe('new_hash');
		});

		it('should use provided existingTokens instead of fetching from cache', async () => {
			const now = Date.now();
			const existing = [{ hash: 'existing_hash', expiresAt: now + 50000 }];

			await service.addToken('user123', 'new_hash', existing);

			// Should NOT call cacheManager.get since existingTokens was provided
			expect(cacheManager.get).not.toHaveBeenCalled();
			const [, savedTokens] = cacheManager.set.mock.calls[0];
			expect(savedTokens).toHaveLength(2);
			expect(savedTokens[1].hash).toBe('new_hash');
		});

		describe('session limit enforcement', () => {
			it('should not evict tokens when maxSessionsPerUser = 0 (unlimited)', async () => {
				appConfigService.maxSessionsPerUser = 0;
				const now = Date.now();
				const existing = [
					{ hash: 'token1', expiresAt: now + 10000 },
					{ hash: 'token2', expiresAt: now + 20000 },
					{ hash: 'token3', expiresAt: now + 30000 },
				];
				cacheManager.get.mockResolvedValue(existing);

				await service.addToken('user123', 'token4');

				const [, savedTokens] = cacheManager.set.mock.calls[0];
				expect(savedTokens).toHaveLength(4);
			});

			it('should evict oldest token (FIFO) when limit is exceeded', async () => {
				appConfigService.maxSessionsPerUser = 2;
				const now = Date.now();
				const existing = [
					{ hash: 'oldest', expiresAt: now + 5000 },
					{ hash: 'newer', expiresAt: now + 30000 },
				];
				cacheManager.get.mockResolvedValue(existing);

				await service.addToken('user123', 'newest');

				const [, savedTokens] = cacheManager.set.mock.calls[0];
				expect(savedTokens).toHaveLength(2);
				// 'oldest' should have been evicted
				const hashes = savedTokens.map((t: any) => t.hash);
				expect(hashes).not.toContain('oldest');
				expect(hashes).toContain('newer');
				expect(hashes).toContain('newest');
			});

			it('should evict multiple oldest tokens when far over limit', async () => {
				appConfigService.maxSessionsPerUser = 2;
				const now = Date.now();
				const existing = [
					{ hash: 'old1', expiresAt: now + 1000 },
					{ hash: 'old2', expiresAt: now + 2000 },
					{ hash: 'old3', expiresAt: now + 3000 },
				];
				cacheManager.get.mockResolvedValue(existing);

				await service.addToken('user123', 'new_token');

				const [, savedTokens] = cacheManager.set.mock.calls[0];
				expect(savedTokens).toHaveLength(2);
				const hashes = savedTokens.map((t: any) => t.hash);
				expect(hashes).toContain('old3');
				expect(hashes).toContain('new_token');
			});
		});
	});

	describe('removeAllTokens', () => {
		it('should delete key from cache', async () => {
			await service.removeAllTokens('user123');
			expect(cacheManager.del).toHaveBeenCalledWith('user-tokens:user123');
		});
	});
});
