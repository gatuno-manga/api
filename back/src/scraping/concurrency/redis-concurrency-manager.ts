import { IConcurrencyManager } from './concurrency-manager.interface';
import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis-based distributed concurrency manager.
 * Suitable for multi-instance deployments where global limits are required.
 *
 * Uses Redis EVAL with Lua scripts for atomic check-and-increment operations.
 * Each slot has a TTL to prevent leaks in case of crashes.
 */
export class RedisConcurrencyManager implements IConcurrencyManager {
    private readonly logger = new Logger(RedisConcurrencyManager.name);
    private readonly keyPrefix = 'scraping:concurrency:';
    private readonly slotTtlMs: number;
    private readonly pollIntervalMs: number;
    private readonly maxWaitMs: number;

    constructor(
        private readonly redis: Redis,
        options?: {
            slotTtlMs?: number;
            pollIntervalMs?: number;
            maxWaitMs?: number;
        },
    ) {
        // Default: slots expire after 20 minutes (enough for long scraping tasks)
        this.slotTtlMs = options?.slotTtlMs ?? 1_200_000;
        this.pollIntervalMs = options?.pollIntervalMs ?? 500;
        // Default: wait up to 1 hour for a slot
        this.maxWaitMs = options?.maxWaitMs ?? 3_600_000;
    }

    /**
     * Lua script to atomically check current count and increment if below limit.
     * Returns the new count if successful, or -1 if limit reached.
     */
    private readonly acquireScript = `
		local key = KEYS[1]
		local limit = tonumber(ARGV[1])
		local ttl = tonumber(ARGV[2])
		local current = tonumber(redis.call('GET', key) or '0')
		if current < limit then
			local newVal = redis.call('INCR', key)
			redis.call('PEXPIRE', key, ttl)
			return newVal
		else
			return -1
		end
	`;

    async acquire(domain: string, limit?: number | null): Promise<void> {
        if (!limit || limit <= 0) return; // unlimited

        const key = this.keyPrefix + domain;
        const startTime = Date.now();

        while (true) {
            try {
                const result = await this.redis.eval(
                    this.acquireScript,
                    1,
                    key,
                    limit.toString(),
                    this.slotTtlMs.toString(),
                );

                if (result !== -1) {
                    // Successfully acquired slot
                    this.logger.debug(
                        `Acquired slot for domain ${domain} (current: ${result}/${limit})`,
                    );
                    return;
                }

                // Limit reached, check timeout
                if (Date.now() - startTime > this.maxWaitMs) {
                    throw new Error(
                        `Timeout waiting for concurrency slot for domain ${domain} (limit: ${limit})`,
                    );
                }

                // Wait before retrying
                await this.sleep(this.pollIntervalMs);
            } catch (error) {
                this.logger.error(
                    `Error acquiring slot for domain ${domain}`,
                    error,
                );
                throw error;
            }
        }
    }

    async release(domain: string): Promise<void> {
        const key = this.keyPrefix + domain;
        try {
            const newVal = await this.redis.decr(key);
            // If counter goes below 0, reset to 0
            if (newVal < 0) {
                await this.redis.set(key, '0');
            }
            this.logger.debug(`Released slot for domain ${domain} (remaining: ${Math.max(0, newVal)})`);
        } catch (error) {
            this.logger.error(`Error releasing slot for domain ${domain}`, error);
            // Don't throw - releasing should be best-effort
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Optional: Clean up all locks for a domain (useful for testing or manual intervention)
     */
    async clearDomain(domain: string): Promise<void> {
        const key = this.keyPrefix + domain;
        await this.redis.del(key);
        this.logger.debug(`Cleared concurrency counter for domain ${domain}`);
    }

    /**
     * Optional: Get current slot usage for a domain
     */
    async getCurrentCount(domain: string): Promise<number> {
        const key = this.keyPrefix + domain;
        const val = await this.redis.get(key);
        return parseInt(val || '0', 10);
    }
}
