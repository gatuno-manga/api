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
			refreshTokenTtl: 604800000,
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

		it('should set tokens with correct TTL', async () => {
			const now = Date.now();
			const tokens = [
				{ hash: 'token1', expiresAt: now + 10000 },
				{ hash: 'token2', expiresAt: now + 5000 },
			];
			
			await service.saveTokens('user123', tokens);
			
			expect(cacheManager.set).toHaveBeenCalled();
			const calls = cacheManager.set.mock.calls;
			// TTL should be based on the earliest expiration (Math.min used in implementation)
			expect(calls[0][2]).toBeLessThanOrEqual(5000);
		});
	});

	describe('addToken', () => {
		it('should add a new token and save', async () => {
			cacheManager.get.mockResolvedValue([]);
			await service.addToken('user123', 'new_hash');
			
			expect(cacheManager.set).toHaveBeenCalled();
			const calls = cacheManager.set.mock.calls;
			expect(calls[0][1]).toHaveLength(1);
			expect(calls[0][1][0].hash).toBe('new_hash');
		});
	});

	describe('removeAllTokens', () => {
		it('should delete key from cache', async () => {
			await service.removeAllTokens('user123');
			expect(cacheManager.del).toHaveBeenCalledWith('user-tokens:user123');
		});
	});
});
