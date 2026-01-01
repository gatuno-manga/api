import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/**
 * Service responsible for cache invalidation across the application.
 * This service provides methods to invalidate cache entries when data is modified.
 */
@Injectable()
export class CacheInvalidationService {
	private readonly logger = new Logger(CacheInvalidationService.name);

	constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

	/**
	 * Invalidate all cache entries related to a specific book
	 * @param bookId - The ID of the book to invalidate cache for
	 */
	async invalidateBook(bookId: string): Promise<void> {
		this.logger.log(`Invalidating cache for book: ${bookId}`);

		const patterns = [
			`books:${bookId}`,
			`books:${bookId}:chapters`,
			`books:${bookId}:covers`,
			`books:${bookId}:infos`,
			'books:list:*',
			'books:random:*',
		];

		for (const pattern of patterns) {
			try {
				await this.cacheManager.del(pattern);
				this.logger.debug(`Deleted cache pattern: ${pattern}`);
			} catch (error) {
				this.logger.error(
					`Error deleting cache pattern ${pattern}:`,
					error,
				);
			}
		}
	}

	/**
	 * Invalidate cache for a specific chapter
	 * @param chapterId - The ID of the chapter to invalidate cache for
	 */
	async invalidateChapter(chapterId: string): Promise<void> {
		this.logger.log(`Invalidating cache for chapter: ${chapterId}`);

		try {
			await this.cacheManager.del(`chapter:${chapterId}`);
		} catch (error) {
			this.logger.error(
				`Error deleting cache for chapter ${chapterId}:`,
				error,
			);
		}
	}

	/**
	 * Invalidate all cache entries related to tags
	 */
	async invalidateTags(): Promise<void> {
		this.logger.log('Invalidating all tags cache');

		const patterns = ['tags:*'];

		for (const pattern of patterns) {
			try {
				await this.cacheManager.del(pattern);
			} catch (error) {
				this.logger.error(`Error deleting tags cache:`, error);
			}
		}
	}

	/**
	 * Invalidate all cache entries related to authors
	 */
	async invalidateAuthors(): Promise<void> {
		this.logger.log('Invalidating all authors cache');

		const patterns = ['authors:*'];

		for (const pattern of patterns) {
			try {
				await this.cacheManager.del(pattern);
			} catch (error) {
				this.logger.error(`Error deleting authors cache:`, error);
			}
		}
	}

	/**
	 * Invalidate all cache entries related to sensitive content
	 */
	async invalidateSensitiveContent(): Promise<void> {
		this.logger.log('Invalidating all sensitive content cache');

		const patterns = ['sensitive-content:*'];

		for (const pattern of patterns) {
			try {
				await this.cacheManager.del(pattern);
			} catch (error) {
				this.logger.error(
					`Error deleting sensitive content cache:`,
					error,
				);
			}
		}
	}

	/**
	 * Invalidate all cache entries with a specific prefix
	 * @param prefix - The prefix to match for cache invalidation
	 */
	async invalidateByPrefix(prefix: string): Promise<void> {
		this.logger.log(`Invalidating cache with prefix: ${prefix}`);

		try {
			await this.cacheManager.del(`${prefix}:*`);
		} catch (error) {
			this.logger.error(
				`Error deleting cache with prefix ${prefix}:`,
				error,
			);
		}
	}

	/**
	 * Reset all cache entries (use with caution)
	 * Note: This will delete all keys matching common patterns
	 */
	async invalidateAll(): Promise<void> {
		this.logger.warn('Invalidating ALL cache entries');

		const patterns = [
			'books:*',
			'chapter:*',
			'tags:*',
			'authors:*',
			'sensitive-content:*',
			'collections:*',
		];

		for (const pattern of patterns) {
			try {
				await this.cacheManager.del(pattern);
			} catch (error) {
				this.logger.error(
					`Error deleting cache pattern ${pattern}:`,
					error,
				);
			}
		}

		this.logger.log('All cache entries have been invalidated');
	}
}
