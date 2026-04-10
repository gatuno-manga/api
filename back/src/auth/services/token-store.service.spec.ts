import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppConfigService } from 'src/app-config/app-config.service';
import { TokenStoreService } from './token-store.service';

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
				{ jti: 'jti-valid', hash: 'valid', expiresAt: now + 1000 },
				{ jti: 'jti-expired', hash: 'expired', expiresAt: now - 1000 },
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
				{
					jti: 'jti-expired-1',
					hash: 'expired1',
					expiresAt: now - 5000,
				},
				{
					jti: 'jti-expired-2',
					hash: 'expired2',
					expiresAt: now - 1000,
				},
			];

			await service.saveTokens('user123', tokens);
			expect(cacheManager.del).toHaveBeenCalledWith(
				'user-tokens:user123',
			);
			expect(cacheManager.set).not.toHaveBeenCalled();
		});

		it('should use Math.max TTL — cache lives as long as the longest-lived token', async () => {
			const now = Date.now();
			const tokens = [
				{
					jti: 'jti-short',
					hash: 'token_short',
					expiresAt: now + 5000,
				},
				{ jti: 'jti-long', hash: 'token_long', expiresAt: now + 60000 },
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
				{ jti: 'jti-valid', hash: 'valid', expiresAt: now + 30000 },
				{ jti: 'jti-expired', hash: 'expired', expiresAt: now - 1000 },
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
			await service.addToken('user123', {
				hash: 'new_hash',
				jti: 'jti-new-hash',
			});

			expect(cacheManager.set).toHaveBeenCalled();
			const [, savedTokens] = cacheManager.set.mock.calls[0];
			expect(savedTokens).toHaveLength(1);
			expect(savedTokens[0].hash).toBe('new_hash');
		});

		it('should use provided existingTokens instead of fetching from cache', async () => {
			const now = Date.now();
			const existing = [
				{
					jti: 'jti-existing-hash',
					hash: 'existing_hash',
					expiresAt: now + 50000,
				},
			];

			await service.addToken(
				'user123',
				{
					hash: 'new_hash',
					jti: 'jti-new-hash',
				},
				existing,
			);

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
					{
						jti: 'jti-token1',
						hash: 'token1',
						expiresAt: now + 10000,
					},
					{
						jti: 'jti-token2',
						hash: 'token2',
						expiresAt: now + 20000,
					},
					{
						jti: 'jti-token3',
						hash: 'token3',
						expiresAt: now + 30000,
					},
				];
				cacheManager.get.mockResolvedValue(existing);

				await service.addToken('user123', {
					hash: 'token4',
					jti: 'jti-token4',
				});

				const [, savedTokens] = cacheManager.set.mock.calls[0];
				expect(savedTokens).toHaveLength(4);
			});

			it('should evict oldest token (FIFO) when limit is exceeded', async () => {
				appConfigService.maxSessionsPerUser = 2;
				const now = Date.now();
				const existing = [
					{
						jti: 'jti-oldest',
						hash: 'oldest',
						expiresAt: now + 5000,
					},
					{ jti: 'jti-newer', hash: 'newer', expiresAt: now + 30000 },
				];
				cacheManager.get.mockResolvedValue(existing);

				await service.addToken('user123', {
					hash: 'newest',
					jti: 'jti-newest',
				});

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
					{ jti: 'jti-old1', hash: 'old1', expiresAt: now + 1000 },
					{ jti: 'jti-old2', hash: 'old2', expiresAt: now + 2000 },
					{ jti: 'jti-old3', hash: 'old3', expiresAt: now + 3000 },
				];
				cacheManager.get.mockResolvedValue(existing);

				await service.addToken('user123', {
					hash: 'new_token',
					jti: 'jti-new-token',
				});

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
			expect(cacheManager.del).toHaveBeenCalledWith(
				'user-tokens:user123',
			);
		});
	});

	describe('revokeTokenFamily', () => {
		it('should revoke only tokens from the targeted family', async () => {
			const now = Date.now();
			const tokens = [
				{
					jti: 'jti-1',
					hash: 'hash-1',
					expiresAt: now + 10000,
					familyId: 'family-a',
				},
				{
					jti: 'jti-2',
					hash: 'hash-2',
					expiresAt: now + 10000,
					familyId: 'family-b',
				},
				{
					jti: 'jti-3',
					hash: 'hash-3',
					expiresAt: now + 10000,
					familyId: 'family-a',
				},
			];

			const revoked = await service.revokeTokenFamily(
				'user123',
				'family-a',
				tokens,
			);

			expect(revoked).toBe(2);
			expect(cacheManager.set).toHaveBeenCalled();
			const [, savedTokens] = cacheManager.set.mock.calls[0];
			expect(savedTokens).toHaveLength(1);
			expect(savedTokens[0].familyId).toBe('family-b');
		});

		it('should do nothing when no token belongs to the family', async () => {
			const now = Date.now();
			const tokens = [
				{
					jti: 'jti-1',
					hash: 'hash-1',
					expiresAt: now + 10000,
					familyId: 'family-b',
				},
			];

			const revoked = await service.revokeTokenFamily(
				'user123',
				'family-a',
				tokens,
			);

			expect(revoked).toBe(0);
			expect(cacheManager.set).not.toHaveBeenCalled();
			expect(cacheManager.del).not.toHaveBeenCalled();
		});
	});

	describe('runWithRefreshLock', () => {
		it('should prevent concurrent refresh for the same user', async () => {
			let releaseFirstLock: (() => void) | undefined;

			const firstRefresh = service.runWithRefreshLock(
				'user123',
				() =>
					new Promise<void>((resolve) => {
						releaseFirstLock = resolve;
					}),
			);

			await Promise.resolve();

			await expect(
				service.runWithRefreshLock('user123', async () => undefined),
			).rejects.toThrow('Refresh already in progress');

			releaseFirstLock?.();
			await firstRefresh;
		});

		it('should allow concurrent refresh for different users', async () => {
			const [first, second] = await Promise.all([
				service.runWithRefreshLock('user123', async () => 'ok-1'),
				service.runWithRefreshLock('user456', async () => 'ok-2'),
			]);

			expect(first).toBe('ok-1');
			expect(second).toBe('ok-2');
		});
	});
});
