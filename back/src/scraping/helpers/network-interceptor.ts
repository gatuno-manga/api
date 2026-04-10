import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import { Page, Response } from 'playwright';

/**
 * Configuration for URL filtering.
 */
export interface UrlFilterConfig {
	/**
	 * Terms that will cause a URL to be ignored (blacklist).
	 */
	blacklistTerms: string[];

	/**
	 * Terms that a URL must contain to be accepted (whitelist).
	 * If empty, all URLs are accepted (unless blacklisted).
	 */
	whitelistTerms: string[];
}

/**
 * Configuration for memory limits.
 */
export interface MemoryLimits {
	/**
	 * Maximum cache size in bytes.
	 * @default 100 * 1024 * 1024 (100MB)
	 */
	maxCacheSize: number;

	/**
	 * Threshold in bytes above which images are streamed to temp files.
	 * @default 5 * 1024 * 1024 (5MB)
	 */
	largeImageThreshold: number;
}

/**
 * Interface for image compression during interception.
 */
export interface ImageCompressor {
	compress(buffer: Buffer, extension?: string): Promise<Buffer>;
	getOutputExtension(originalExtension: string): string;
}

/**
 * Cached image data.
 */
export interface CachedImage {
	url: string;
	data: Buffer | null; // null if offloaded to temp file
	contentType: string;
	/** Whether the image has been compressed */
	compressed: boolean;
	/** Final extension after compression */
	extension: string;
	/** Temporary file path if offloaded */
	tempFilePath?: string;
	/** Last access time for LRU eviction */
	lastAccess: number;
}

const DEFAULT_MEMORY_LIMITS: MemoryLimits = {
	maxCacheSize: 100 * 1024 * 1024, // 100MB
	largeImageThreshold: 5 * 1024 * 1024, // 5MB
};

/**
 * Helper for intercepting network traffic and caching images.
 * This is more efficient than fetching images separately after the page loads.
 * Optionally compresses images immediately upon caching for memory efficiency.
 * Implements memory management via LRU eviction and temp file offloading.
 */
export class NetworkInterceptor {
	readonly logger = new Logger(NetworkInterceptor.name);
	private readonly imageCache = new Map<string, CachedImage>();
	isIntercepting = false;
	/** Active compression promises; entries are deleted on completion so the set stays small. */
	private readonly compressionQueue = new Set<Promise<void>>();
	private currentCacheSize = 0;
	/** Sum of raw body bytes currently waiting for a compression slot (not yet in cache). */
	private inFlightBytes = 0;
	private tempFiles: Set<string> = new Set();
	private readonly memoryLimits: MemoryLimits;

	/** Named handler stored so it can be removed via page.off() */
	private readonly responseHandler = (response: Response): void => {
		void this.handleResponse(response);
	};

	/** Maximum number of concurrent image compressions */
	private readonly compressionConcurrency: number;
	private activeCompressions = 0;
	private readonly compressionWaiters: Array<() => void> = [];

	/** Set to true by clearCache() to prevent stale compressions from re-populating the cache */
	private _cleared = false;

	constructor(
		private readonly page: Page,
		private readonly filterConfig: UrlFilterConfig = {
			blacklistTerms: [],
			whitelistTerms: [],
		},
		readonly compressor?: ImageCompressor,
		memoryLimits?: Partial<MemoryLimits>,
		compressionConcurrency?: number,
	) {
		this.memoryLimits = { ...DEFAULT_MEMORY_LIMITS, ...memoryLimits };
		this.compressionConcurrency =
			compressionConcurrency ??
			Number(process.env.SCRAPING_COMPRESSION_CONCURRENCY ?? '4');
	}

	/**
	 * Check if a URL should be accepted based on filter configuration.
	 */
	shouldAcceptUrl(url: string): boolean {
		const lowerUrl = url.toLowerCase();

		// Check blacklist first
		if (this.filterConfig.blacklistTerms.length > 0) {
			for (const term of this.filterConfig.blacklistTerms) {
				if (lowerUrl.includes(term.toLowerCase())) {
					return false;
				}
			}
		}

		// Check whitelist (if configured)
		if (this.filterConfig.whitelistTerms.length > 0) {
			for (const term of this.filterConfig.whitelistTerms) {
				if (lowerUrl.includes(term.toLowerCase())) {
					return true;
				}
			}
			// Whitelist is configured but URL doesn't match any term
			return false;
		}

		// No whitelist configured, accept all non-blacklisted URLs
		return true;
	}

	/**
	 * Extract extension from content-type or URL.
	 */
	private getExtensionFromResponse(url: string, contentType: string): string {
		// Try content-type first
		const ct = contentType.toLowerCase();
		if (ct.includes('png')) return '.png';
		if (ct.includes('webp')) return '.webp';
		if (ct.includes('gif')) return '.gif';
		if (ct.includes('svg')) return '.svg';
		if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg';

		// Fallback to URL
		const urlPath = new URL(url).pathname.toLowerCase();
		if (urlPath.includes('.png')) return '.png';
		if (urlPath.includes('.webp')) return '.webp';
		if (urlPath.includes('.gif')) return '.gif';
		if (urlPath.includes('.svg')) return '.svg';

		return '.jpg';
	}

	/**
	 * Handle a network response and cache image data.
	 * Optionally compresses the image immediately for memory efficiency.
	 */
	private async handleResponse(response: Response): Promise<void> {
		// Ignore responses that arrive after interception was stopped
		if (!this.isIntercepting) return;

		try {
			const request = response.request();
			const resourceType = request.resourceType();

			// Only intercept images
			if (resourceType !== 'image') return;

			// Only cache successful responses
			if (!response.ok()) return;

			const url = response.url();

			// Apply URL filters
			if (!this.shouldAcceptUrl(url)) {
				this.logger.debug(`URL filtered out: ${url}`);
				return;
			}

			// Get response body
			const body = await response.body();

			// Skip empty responses (e.g. 204 no-content, ad trackers)
			if (body.length === 0) {
				this.logger.debug(`Skipping empty-body response: ${url}`);
				return;
			}

			const contentType =
				response.headers()['content-type'] || 'image/jpeg';
			const originalExtension = this.getExtensionFromResponse(
				url,
				contentType,
			);
			const originalSize = body.length;

			// Check if we need to offload to temp file
			if (originalSize > this.memoryLimits.largeImageThreshold) {
				await this.cacheToTempFile(
					url,
					body,
					contentType,
					originalExtension,
					originalSize,
				);
				return;
			}

			// Ensure cache doesn't exceed limit
			await this.ensureCacheSpace(originalSize);

			// If compressor is available, compress immediately (non-blocking, concurrency-limited)
			if (this.compressor) {
				// Guard: count in-flight bytes (queued but not yet in cache) against the
				// same limit as the cache itself. Without this, every image response
				// simultaneously adds its raw body to async closures with no cap.
				if (
					this.currentCacheSize + this.inFlightBytes + originalSize >
					this.memoryLimits.maxCacheSize
				) {
					this.logger.warn(
						`Memory limit reached (cache=${this.currentCacheSize}, in-flight=${this.inFlightBytes}), skipping: ${url}`,
					);
					return;
				}
				this.inFlightBytes += originalSize;
				const compressionTask = this.compressAndCache(
					url,
					body,
					contentType,
					originalExtension,
					originalSize,
				);
				this.compressionQueue.add(compressionTask);
				// Self-cleaning: remove from the set once settled so the set never grows unboundedly.
				void compressionTask.finally(() =>
					this.compressionQueue.delete(compressionTask),
				);
			} else {
				// Cache without compression
				this.addToCache(url, {
					url,
					data: body,
					contentType,
					compressed: false,
					extension: originalExtension,
					lastAccess: Date.now(),
				});
				this.logger.debug(
					`Cached image: ${url} (${originalSize} bytes)`,
				);
			}
		} catch (error) {
			// Silently ignore errors (response might be unavailable)
		}
	}

	/**
	 * Ensure there's enough space in the cache by evicting LRU entries.
	 */
	private ensureCacheSpace(requiredBytes: number): Promise<void> {
		while (
			this.currentCacheSize + requiredBytes >
			this.memoryLimits.maxCacheSize
		) {
			const evicted = this.evictLRU();
			if (!evicted) {
				this.logger.warn(
					'Failed to evict LRU entry, cache may exceed limit',
				);
				break;
			}
		}
		return Promise.resolve();
	}

	/**
	 * Evict the least recently used cache entry.
	 */
	private evictLRU(): boolean {
		let oldestUrl: string | null = null;
		let oldestTime = Number.MAX_SAFE_INTEGER;

		for (const [url, cached] of this.imageCache.entries()) {
			if (cached.lastAccess < oldestTime) {
				oldestTime = cached.lastAccess;
				oldestUrl = url;
			}
		}

		if (oldestUrl) {
			const evicted = this.imageCache.get(oldestUrl);
			this.imageCache.delete(oldestUrl);
			if (evicted?.data) {
				this.currentCacheSize -= evicted.data.length;
			}
			this.logger.debug(
				`Evicted LRU image: ${oldestUrl} (${evicted?.data?.length || 0} bytes)`,
			);
			return true;
		}

		return false;
	}

	/**
	 * Add an image to the cache and update size tracking.
	 */
	private addToCache(url: string, cached: CachedImage): void {
		// Do not re-populate after clearCache() has been called
		if (this._cleared) return;

		// Remove old entry if exists
		const old = this.imageCache.get(url);
		if (old?.data) {
			this.currentCacheSize -= old.data.length;
		}

		// Add new entry
		this.imageCache.set(url, cached);
		if (cached.data) {
			this.currentCacheSize += cached.data.length;
		}
	}

	/**
	 * Cache a large image to a temporary file.
	 */
	private async cacheToTempFile(
		url: string,
		body: Buffer,
		contentType: string,
		extension: string,
		size: number,
	): Promise<void> {
		try {
			const tempDir = await fs.mkdtemp(
				path.join(os.tmpdir(), 'gatuno-cache-'),
			);
			const tempFilePath = path.join(
				tempDir,
				`image-${Date.now()}${extension}`,
			);
			await fs.writeFile(tempFilePath, body);
			this.tempFiles.add(tempFilePath);

			this.imageCache.set(url, {
				url,
				data: null,
				contentType,
				compressed: false,
				extension,
				tempFilePath,
				lastAccess: Date.now(),
			});

			this.logger.debug(
				`Large image offloaded to temp file: ${url} (${size} bytes) -> ${tempFilePath}`,
			);
		} catch (error) {
			this.logger.error(
				`Failed to offload to temp file: ${error.message}`,
			);
		}
	}

	/**
	 * Acquire a compression slot (blocks if concurrency limit is reached).
	 */
	private waitForCompressionSlot(): Promise<void> {
		if (this.activeCompressions < this.compressionConcurrency) {
			this.activeCompressions++;
			return Promise.resolve();
		}
		return new Promise<void>((resolve) => {
			this.compressionWaiters.push(resolve);
		}).then(() => {
			this.activeCompressions++;
		});
	}

	/**
	 * Release a compression slot and wake up the next waiter if any.
	 */
	private releaseCompressionSlot(): void {
		this.activeCompressions = Math.max(0, this.activeCompressions - 1);
		const next = this.compressionWaiters.shift();
		if (next) next();
	}

	/**
	 * Compress and cache an image asynchronously.
	 * Respects the concurrency semaphore and the _cleared flag.
	 */
	private async compressAndCache(
		url: string,
		body: Buffer,
		contentType: string,
		originalExtension: string,
		originalSize: number,
	): Promise<void> {
		await this.waitForCompressionSlot();
		// Slot acquired: the body buffer is now being actively processed, so
		// remove it from the in-flight accounting (it will enter the cache next).
		this.inFlightBytes = Math.max(0, this.inFlightBytes - originalSize);
		try {
			// Session was cleared while we were waiting — discard work
			if (this._cleared) return;

			const compressedData = await this.compressor?.compress(
				body,
				originalExtension,
			);
			const outputExtension =
				this.compressor?.getOutputExtension(originalExtension);

			if (!compressedData || !outputExtension) {
				throw new Error('Compression failed to produce valid data');
			}

			if (this._cleared) return;

			const compressedSize = compressedData.length;
			const savings = ((1 - compressedSize / originalSize) * 100).toFixed(
				1,
			);

			// Ensure cache space before adding
			await this.ensureCacheSpace(compressedSize);

			this.addToCache(url, {
				url,
				data: compressedData,
				contentType: 'image/webp', // After compression
				compressed: true,
				extension: outputExtension,
				lastAccess: Date.now(),
			});

			this.logger.debug(
				`Cached & compressed: ${url} (${originalSize} → ${compressedSize} bytes, -${savings}%)`,
			);
		} catch (error) {
			if (this._cleared) return;

			// Fallback: cache original on compression error
			await this.ensureCacheSpace(originalSize);
			this.addToCache(url, {
				url,
				data: body,
				contentType,
				compressed: false,
				extension: originalExtension,
				lastAccess: Date.now(),
			});
			this.logger.warn(`Compression failed for ${url}, caching original`);
		} finally {
			this.releaseCompressionSlot();
			// Ensure inFlightBytes never drifts negative on unexpected paths.
			this.inFlightBytes = Math.max(0, this.inFlightBytes);
		}
	}

	/**
	 * Wait for all pending compressions to complete.
	 * Call this before accessing the cache to ensure all images are ready.
	 */
	async waitForCompressions(): Promise<void> {
		if (this.compressionQueue.size > 0) {
			this.logger.debug(
				`Waiting for ${this.compressionQueue.size} compressions...`,
			);
			await Promise.allSettled([...this.compressionQueue]);
			this.logger.debug('All compressions complete');
		}
	}

	/**
	 * Start intercepting network traffic.
	 * Call this BEFORE navigating to the page.
	 */
	startInterception(): Promise<void> {
		if (this.isIntercepting) return Promise.resolve();

		this.page.on('response', this.responseHandler);
		this.isIntercepting = true;
		this.logger.debug('Network interception started');
		return Promise.resolve();
	}

	/**
	 * Stop intercepting (cleanup).
	 * Removes the named response listener so no further responses are processed.
	 */
	stopInterception(): void {
		if (!this.isIntercepting) return;
		this.isIntercepting = false;
		this.page.off('response', this.responseHandler);
		this.logger.debug(
			`Network interception stopped. Cached ${this.imageCache.size} images`,
		);
	}

	/**
	 * Get a cached image by URL.
	 */
	getCachedImage(url: string): CachedImage | undefined {
		// Try exact match first
		const cached = this.imageCache.get(url);
		if (cached) return cached;

		// Try matching without query parameters
		const urlWithoutQuery = url.split('?')[0];
		for (const [cachedUrl, image] of this.imageCache) {
			if (cachedUrl.split('?')[0] === urlWithoutQuery) {
				return image;
			}
		}

		return undefined;
	}

	/**
	 * Get a cached image as Buffer (preferred - more efficient).
	 * Loads from temp file if image was offloaded.
	 */
	async getCachedImageAsBuffer(url: string): Promise<Buffer | null> {
		const cached = this.getCachedImage(url);
		if (!cached) return null;

		// Update last access time for LRU
		cached.lastAccess = Date.now();

		// If has data in memory, return it
		if (cached.data) {
			return cached.data;
		}

		// Load from temp file
		if (cached.tempFilePath) {
			try {
				const fileData = await fs.readFile(cached.tempFilePath);
				return fileData;
			} catch (error) {
				this.logger.error(
					`Failed to read temp file ${cached.tempFilePath}: ${error.message}`,
				);
				return null;
			}
		}

		return null;
	}

	/**
	 * Get a cached image as base64.
	 * @deprecated Use getCachedImageAsBuffer for better performance
	 */
	async getCachedImageAsBase64(url: string): Promise<string | null> {
		const buffer = await this.getCachedImageAsBuffer(url);
		if (!buffer) return null;
		return buffer.toString('base64');
	}

	/**
	 * Check if an image is in the cache.
	 */
	hasImage(url: string): boolean {
		return this.getCachedImage(url) !== undefined;
	}

	/**
	 * Check if an image was compressed.
	 */
	isCompressed(url: string): boolean {
		const cached = this.getCachedImage(url);
		return cached?.compressed ?? false;
	}

	/**
	 * Get all cached image URLs.
	 */
	getCachedUrls(): string[] {
		return Array.from(this.imageCache.keys());
	}

	/**
	 * Get cache statistics.
	 */
	getStats(): {
		count: number;
		totalBytes: number;
		compressedCount: number;
		tempFileCount: number;
	} {
		let totalBytes = 0;
		let compressedCount = 0;
		let tempFileCount = 0;
		for (const image of this.imageCache.values()) {
			if (image.data) {
				totalBytes += image.data.length;
			}
			if (image.compressed) compressedCount++;
			if (image.tempFilePath) tempFileCount++;
		}
		return {
			count: this.imageCache.size,
			totalBytes,
			compressedCount,
			tempFileCount,
		};
	}

	/**
	 * Clear the cache and delete temp files.
	 * Awaits all in-flight compressions before clearing to prevent stale re-population.
	 */
	async clearCache(): Promise<void> {
		// Signal that no new entries should be added
		this._cleared = true;

		// Drain all in-flight compressions before wiping the cache
		if (this.compressionQueue.size > 0) {
			this.logger.debug(
				`clearCache: awaiting ${this.compressionQueue.size} in-flight compressions...`,
			);
			await Promise.allSettled([...this.compressionQueue]);
		}
		this.compressionQueue.clear();
		this.compressionWaiters.length = 0;
		this.activeCompressions = 0;
		this.inFlightBytes = 0;

		// Delete temp files
		for (const tempFilePath of this.tempFiles) {
			try {
				await fs.unlink(tempFilePath);
				this.logger.debug(`Deleted temp file: ${tempFilePath}`);
			} catch (error) {
				this.logger.warn(
					`Failed to delete temp file ${tempFilePath}: ${error.message}`,
				);
			}
		}
		this.tempFiles.clear();

		// Clear cache
		this.imageCache.clear();
		this.currentCacheSize = 0;
	}

	/**
	 * Get file extension for a cached image.
	 * Returns the final extension (after compression if applicable).
	 */
	getExtension(url: string): string {
		const cached = this.getCachedImage(url);
		if (cached) {
			return cached.extension;
		}

		// Fallback to URL extension
		const urlPath = new URL(url).pathname.toLowerCase();
		if (urlPath.includes('.png')) return '.png';
		if (urlPath.includes('.webp')) return '.webp';
		if (urlPath.includes('.gif')) return '.gif';
		if (urlPath.includes('.svg')) return '.svg';

		return '.jpg';
	}
}
