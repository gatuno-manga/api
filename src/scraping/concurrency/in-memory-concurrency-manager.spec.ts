import { InMemoryConcurrencyManager } from './in-memory-concurrency-manager';

describe('InMemoryConcurrencyManager', () => {
	let manager: InMemoryConcurrencyManager;

	beforeEach(() => {
		manager = new InMemoryConcurrencyManager();
	});

	describe('acquire and release', () => {
		it('should allow unlimited access when limit is null', async () => {
			const domain = 'example.com';
			await expect(
				manager.acquire(domain, null),
			).resolves.toBeUndefined();
			await expect(
				manager.acquire(domain, null),
			).resolves.toBeUndefined();
			await expect(
				manager.acquire(domain, null),
			).resolves.toBeUndefined();
		});

		it('should allow unlimited access when limit is 0', async () => {
			const domain = 'example.com';
			await expect(manager.acquire(domain, 0)).resolves.toBeUndefined();
			await expect(manager.acquire(domain, 0)).resolves.toBeUndefined();
		});

		it('should allow unlimited access when limit is negative', async () => {
			const domain = 'example.com';
			await expect(manager.acquire(domain, -1)).resolves.toBeUndefined();
		});

		it('should allow acquire up to limit', async () => {
			const domain = 'example.com';
			const limit = 3;

			// Should acquire all 3 slots immediately
			await expect(
				manager.acquire(domain, limit),
			).resolves.toBeUndefined();
			await expect(
				manager.acquire(domain, limit),
			).resolves.toBeUndefined();
			await expect(
				manager.acquire(domain, limit),
			).resolves.toBeUndefined();
		});

		it('should block when limit is reached', async () => {
			const domain = 'example.com';
			const limit = 2;

			// Acquire 2 slots
			await manager.acquire(domain, limit);
			await manager.acquire(domain, limit);

			// Third acquire should block
			let thirdResolved = false;
			const thirdPromise = manager.acquire(domain, limit).then(() => {
				thirdResolved = true;
			});

			// Wait a bit to ensure it's blocked
			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(thirdResolved).toBe(false);

			// Release one slot
			manager.release(domain);

			// Now third should resolve
			await thirdPromise;
			expect(thirdResolved).toBe(true);
		});

		it('should handle multiple domains independently', async () => {
			const domain1 = 'example.com';
			const domain2 = 'another.com';
			const limit = 1;

			// Acquire slot for domain1
			await manager.acquire(domain1, limit);

			// Should still be able to acquire slot for domain2
			await expect(
				manager.acquire(domain2, limit),
			).resolves.toBeUndefined();

			// domain1 should block
			let domain1Resolved = false;
			manager.acquire(domain1, limit).then(() => {
				domain1Resolved = true;
			});

			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(domain1Resolved).toBe(false);

			// Release domain2 should not affect domain1
			manager.release(domain2);
			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(domain1Resolved).toBe(false);

			// Release domain1 should unblock
			manager.release(domain1);
			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(domain1Resolved).toBe(true);
		});

		it('should maintain FIFO queue order', async () => {
			const domain = 'example.com';
			const limit = 1;
			const order: number[] = [];

			// Acquire first slot
			await manager.acquire(domain, limit);

			// Queue 3 more acquires
			const promise1 = manager
				.acquire(domain, limit)
				.then(() => order.push(1));
			const promise2 = manager
				.acquire(domain, limit)
				.then(() => order.push(2));
			const promise3 = manager
				.acquire(domain, limit)
				.then(() => order.push(3));

			// Release slots one by one
			await new Promise((resolve) => setTimeout(resolve, 10));
			manager.release(domain);
			await new Promise((resolve) => setTimeout(resolve, 10));
			manager.release(domain);
			await new Promise((resolve) => setTimeout(resolve, 10));
			manager.release(domain);

			// Wait for all to complete
			await Promise.all([promise1, promise2, promise3]);

			// Should resolve in FIFO order
			expect(order).toEqual([1, 2, 3]);
		});

		it('should handle multiple releases safely', async () => {
			const domain = 'example.com';

			// Release without acquire should not crash
			expect(() => manager.release(domain)).not.toThrow();
			expect(() => manager.release(domain)).not.toThrow();

			// Should still work normally after
			await expect(manager.acquire(domain, 1)).resolves.toBeUndefined();
			manager.release(domain);
		});
	});

	describe('concurrent operations', () => {
		it('should handle concurrent acquires correctly', async () => {
			const domain = 'example.com';
			const limit = 5;
			const operations = 10;

			let activeCount = 0;
			let maxActive = 0;
			const promises: Promise<void>[] = [];

			for (let i = 0; i < operations; i++) {
				const promise = (async () => {
					await manager.acquire(domain, limit);
					activeCount++;
					maxActive = Math.max(maxActive, activeCount);
					// Simulate work
					await new Promise((resolve) => setTimeout(resolve, 10));
					activeCount--;
					manager.release(domain);
				})();
				promises.push(promise);
			}

			await Promise.all(promises);

			// Max active should never exceed limit
			expect(maxActive).toBeLessThanOrEqual(limit);
			expect(maxActive).toBeGreaterThan(0);
		});
	});
});
