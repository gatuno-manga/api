import { RedisConcurrencyManager } from './redis-concurrency-manager';

describe('RedisConcurrencyManager', () => {
	let manager: RedisConcurrencyManager;
	let mockRedis: any;

	beforeEach(() => {
		// Create mock Redis instance
		mockRedis = {
			eval: jest.fn(),
			decr: jest.fn(),
			set: jest.fn(),
			del: jest.fn(),
			get: jest.fn(),
		};

		manager = new RedisConcurrencyManager(mockRedis, {
			slotTtlMs: 1000,
			pollIntervalMs: 10,
			maxWaitMs: 1000,
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('acquire', () => {
		it('should allow unlimited access when limit is null', async () => {
			await expect(
				manager.acquire('example.com', null),
			).resolves.toBeUndefined();
			expect(mockRedis.eval).not.toHaveBeenCalled();
		});

		it('should allow unlimited access when limit is 0', async () => {
			await expect(
				manager.acquire('example.com', 0),
			).resolves.toBeUndefined();
			expect(mockRedis.eval).not.toHaveBeenCalled();
		});

		it('should allow unlimited access when limit is negative', async () => {
			await expect(
				manager.acquire('example.com', -1),
			).resolves.toBeUndefined();
			expect(mockRedis.eval).not.toHaveBeenCalled();
		});

		it('should acquire slot successfully when below limit', async () => {
			const domain = 'example.com';
			const limit = 5;

			// Mock eval to return successful acquisition (new count = 1)
			mockRedis.eval.mockResolvedValue(1);

			await expect(
				manager.acquire(domain, limit),
			).resolves.toBeUndefined();

			expect(mockRedis.eval).toHaveBeenCalledWith(
				expect.any(String), // Lua script
				1,
				'scraping:concurrency:example.com',
				'5',
				'1000',
			);
		});

		it('should retry when limit is reached and eventually acquire', async () => {
			const domain = 'example.com';
			const limit = 2;

			// First call returns -1 (limit reached), second call returns 2 (acquired)
			mockRedis.eval
				.mockResolvedValueOnce(-1)
				.mockResolvedValueOnce(-1)
				.mockResolvedValueOnce(2);

			await expect(
				manager.acquire(domain, limit),
			).resolves.toBeUndefined();

			// Should have been called 3 times (2 failures + 1 success)
			expect(mockRedis.eval).toHaveBeenCalledTimes(3);
		});

		it('should timeout after maxWaitMs when limit never becomes available', async () => {
			const domain = 'example.com';
			const limit = 1;

			// Always return -1 (limit reached)
			mockRedis.eval.mockResolvedValue(-1);

			await expect(manager.acquire(domain, limit)).rejects.toThrow(
				/Timeout waiting for concurrency slot/,
			);

			// Should have been called multiple times before timeout
			expect(mockRedis.eval.mock.calls.length).toBeGreaterThan(1);
		});

		it('should use correct Redis key with prefix', async () => {
			const domain = 'test.example.com';
			const limit = 3;

			mockRedis.eval.mockResolvedValue(1);

			await manager.acquire(domain, limit);

			expect(mockRedis.eval).toHaveBeenCalledWith(
				expect.any(String),
				1,
				'scraping:concurrency:test.example.com',
				expect.any(String),
				expect.any(String),
			);
		});

		it('should propagate Redis errors', async () => {
			const domain = 'example.com';
			const limit = 5;

			const redisError = new Error('Redis connection failed');
			mockRedis.eval.mockRejectedValue(redisError);

			await expect(manager.acquire(domain, limit)).rejects.toThrow(
				'Redis connection failed',
			);
		});
	});

	describe('release', () => {
		it('should decrement counter', async () => {
			const domain = 'example.com';

			mockRedis.decr.mockResolvedValue(2);

			await manager.release(domain);

			expect(mockRedis.decr).toHaveBeenCalledWith(
				'scraping:concurrency:example.com',
			);
		});

		it('should reset counter to 0 if it goes negative', async () => {
			const domain = 'example.com';

			mockRedis.decr.mockResolvedValue(-1);

			await manager.release(domain);

			expect(mockRedis.decr).toHaveBeenCalled();
			expect(mockRedis.set).toHaveBeenCalledWith(
				'scraping:concurrency:example.com',
				'0',
			);
		});

		it('should not throw on Redis errors', async () => {
			const domain = 'example.com';

			mockRedis.decr.mockRejectedValue(new Error('Redis error'));

			// Should not throw
			await expect(manager.release(domain)).resolves.toBeUndefined();
		});
	});

	describe('clearDomain', () => {
		it('should delete Redis key for domain', async () => {
			const domain = 'example.com';

			mockRedis.del.mockResolvedValue(1);

			await manager.clearDomain(domain);

			expect(mockRedis.del).toHaveBeenCalledWith(
				'scraping:concurrency:example.com',
			);
		});
	});

	describe('getCurrentCount', () => {
		it('should return current count from Redis', async () => {
			const domain = 'example.com';

			mockRedis.get.mockResolvedValue('5');

			const count = await manager.getCurrentCount(domain);

			expect(count).toBe(5);
			expect(mockRedis.get).toHaveBeenCalledWith(
				'scraping:concurrency:example.com',
			);
		});

		it('should return 0 when key does not exist', async () => {
			const domain = 'example.com';

			mockRedis.get.mockResolvedValue(null);

			const count = await manager.getCurrentCount(domain);

			expect(count).toBe(0);
		});
	});

	describe('concurrent operations simulation', () => {
		it('should handle multiple domains independently', async () => {
			const domain1 = 'example.com';
			const domain2 = 'another.com';

			mockRedis.eval.mockResolvedValue(1);

			await Promise.all([
				manager.acquire(domain1, 5),
				manager.acquire(domain2, 3),
			]);

			// Should have called eval twice with different keys
			expect(mockRedis.eval).toHaveBeenCalledTimes(2);
			expect(mockRedis.eval).toHaveBeenCalledWith(
				expect.any(String),
				1,
				'scraping:concurrency:example.com',
				expect.any(String),
				expect.any(String),
			);
			expect(mockRedis.eval).toHaveBeenCalledWith(
				expect.any(String),
				1,
				'scraping:concurrency:another.com',
				expect.any(String),
				expect.any(String),
			);
		});
	});
});
