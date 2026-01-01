import { IConcurrencyManager } from './concurrency-manager.interface';

/**
 * In-memory implementation of concurrency manager.
 * Suitable for single-instance deployments.
 * Note: Limits are per-process, not global across multiple instances.
 */
export class InMemoryConcurrencyManager implements IConcurrencyManager {
	private counters = new Map<string, number>();
	private queues = new Map<string, Array<() => void>>();

	async acquire(domain: string, limit?: number | null): Promise<void> {
		if (!limit || limit <= 0) return; // unlimited
		const current = this.counters.get(domain) ?? 0;
		if (current < limit) {
			this.counters.set(domain, current + 1);
			return;
		}
		// block until slot is available
		return new Promise<void>((resolve) => {
			const q = this.queues.get(domain) ?? [];
			q.push(() => {
				this.counters.set(domain, (this.counters.get(domain) ?? 0) + 1);
				resolve();
			});
			this.queues.set(domain, q);
		});
	}

	release(domain: string): void {
		const current = Math.max(0, (this.counters.get(domain) ?? 1) - 1);
		this.counters.set(domain, current);
		const q = this.queues.get(domain);
		if (q && q.length > 0) {
			const next = q.shift();
			if (next) next();
			this.queues.set(domain, q);
		}
	}
}
