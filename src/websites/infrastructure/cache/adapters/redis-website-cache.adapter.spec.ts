import { Test, TestingModule } from '@nestjs/testing';
import { Website } from '@websites/domain/entities/website';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { RedisWebsiteCacheAdapter } from './redis-website-cache.adapter';

describe('RedisWebsiteCacheAdapter', () => {
	let adapter: RedisWebsiteCacheAdapter;
	let redisClientMock: any;

	beforeEach(async () => {
		redisClientMock = {
			set: jest.fn(),
			del: jest.fn(),
		};

		const redisServiceMock = {
			getClient: jest.fn().mockReturnValue(redisClientMock),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				RedisWebsiteCacheAdapter,
				{
					provide: RedisService,
					useValue: redisServiceMock,
				},
			],
		}).compile();

		adapter = module.get<RedisWebsiteCacheAdapter>(
			RedisWebsiteCacheAdapter,
		);
	});

	it('should be defined', () => {
		expect(adapter).toBeDefined();
	});

	describe('set', () => {
		it('should call redis set with the correct key and stringified website', async () => {
			const website = new Website();
			website.id = 'test-id';
			website.url = 'https://test.com';

			await adapter.set(website);

			expect(redisClientMock.set).toHaveBeenCalledWith(
				'website:config:test-id',
				JSON.stringify(website),
			);
		});
	});

	describe('delete', () => {
		it('should call redis del with the correct key', async () => {
			await adapter.delete('test-id');

			expect(redisClientMock.del).toHaveBeenCalledWith(
				'website:config:test-id',
			);
		});
	});
});
