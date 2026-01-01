/**
 * Interface for managing concurrency limits per domain.
 * Implementations can be in-memory (single instance) or distributed (Redis).
 */
export interface IConcurrencyManager {
	/**
	 * Acquire a slot for the given domain. If limit is reached, waits until a slot is available.
	 * @param domain - The domain name (hostname) to acquire a slot for
	 * @param limit - Maximum concurrent operations allowed. If null/undefined/<=0, no limit is enforced.
	 * @returns Promise that resolves when slot is acquired
	 */
	acquire(domain: string, limit?: number | null): Promise<void>;

	/**
	 * Release a slot for the given domain, allowing waiting operations to proceed.
	 * @param domain - The domain name (hostname) to release a slot for
	 */
	release(domain: string): void | Promise<void>;
}
