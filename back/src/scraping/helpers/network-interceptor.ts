import { Logger } from '@nestjs/common';
import type { Page, Response } from 'playwright';

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
 * Interface for image compression during interception.
 */
export interface ImageCompressor {
	compress(buffer: Buffer): Promise<Buffer>;
	getOutputExtension(originalExtension: string): string;
}

/**
 * Cached image data.
 */
export interface CachedImage {
	url: string;
	data: Buffer;
	contentType: string;
	/** Whether the image has been compressed */
	compressed: boolean;
	/** Final extension after compression */
	extension: string;
}

/**
 * Helper for intercepting network traffic and caching images.
 * This is more efficient than fetching images separately after the page loads.
 * Optionally compresses images immediately upon caching for memory efficiency.
 */
export class NetworkInterceptor {
	private readonly logger = new Logger(NetworkInterceptor.name);
	private readonly imageCache = new Map<string, CachedImage>();
	private isIntercepting = false;
	private compressionQueue: Promise<void>[] = [];

	constructor(
		private readonly page: Page,
		private readonly filterConfig: UrlFilterConfig = {
			blacklistTerms: [],
			whitelistTerms: [],
		},
		private readonly compressor?: ImageCompressor,
	) {}

	/**
	 * Check if a URL should be accepted based on filter configuration.
	 */
	private shouldAcceptUrl(url: string): boolean {
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
			const contentType =
				response.headers()['content-type'] || 'image/jpeg';
			const originalExtension = this.getExtensionFromResponse(
				url,
				contentType,
			);
			const originalSize = body.length;

			// If compressor is available, compress immediately (non-blocking)
			if (this.compressor) {
				const compressionTask = this.compressAndCache(
					url,
					body,
					contentType,
					originalExtension,
					originalSize,
				);
				this.compressionQueue.push(compressionTask);
			} else {
				// Cache without compression
				this.imageCache.set(url, {
					url,
					data: body,
					contentType,
					compressed: false,
					extension: originalExtension,
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
	 * Compress and cache an image asynchronously.
	 */
	private async compressAndCache(
		url: string,
		body: Buffer,
		contentType: string,
		originalExtension: string,
		originalSize: number,
	): Promise<void> {
		try {
			const compressedData = await this.compressor!.compress(body);
			const outputExtension =
				this.compressor!.getOutputExtension(originalExtension);
			const compressedSize = compressedData.length;
			const savings = ((1 - compressedSize / originalSize) * 100).toFixed(
				1,
			);

			this.imageCache.set(url, {
				url,
				data: compressedData,
				contentType: 'image/webp', // After compression
				compressed: true,
				extension: outputExtension,
			});

			this.logger.debug(
				`Cached & compressed: ${url} (${originalSize} → ${compressedSize} bytes, -${savings}%)`,
			);
		} catch (error) {
			// Fallback: cache original on compression error
			this.imageCache.set(url, {
				url,
				data: body,
				contentType,
				compressed: false,
				extension: originalExtension,
			});
			this.logger.warn(`Compression failed for ${url}, caching original`);
		}
	}

	/**
	 * Wait for all pending compressions to complete.
	 * Call this before accessing the cache to ensure all images are ready.
	 */
	async waitForCompressions(): Promise<void> {
		if (this.compressionQueue.length > 0) {
			this.logger.debug(
				`Waiting for ${this.compressionQueue.length} compressions...`,
			);
			await Promise.all(this.compressionQueue);
			this.compressionQueue = [];
			this.logger.debug('All compressions complete');
		}
	}

	/**
	 * Start intercepting network traffic.
	 * Call this BEFORE navigating to the page.
	 */
	async startInterception(): Promise<void> {
		if (this.isIntercepting) return;

		this.page.on('response', (response) => this.handleResponse(response));
		this.isIntercepting = true;
		this.logger.debug('Network interception started');
	}

	/**
	 * Stop intercepting (cleanup).
	 */
	stopInterception(): void {
		this.isIntercepting = false;
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
	 */
	getCachedImageAsBuffer(url: string): Buffer | null {
		const cached = this.getCachedImage(url);
		if (!cached) return null;
		return cached.data;
	}

	/**
	 * Get a cached image as base64.
	 * @deprecated Use getCachedImageAsBuffer for better performance
	 */
	getCachedImageAsBase64(url: string): string | null {
		const cached = this.getCachedImage(url);
		if (!cached) return null;
		return cached.data.toString('base64');
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
	getStats(): { count: number; totalBytes: number; compressedCount: number } {
		let totalBytes = 0;
		let compressedCount = 0;
		for (const image of this.imageCache.values()) {
			totalBytes += image.data.length;
			if (image.compressed) compressedCount++;
		}
		return {
			count: this.imageCache.size,
			totalBytes,
			compressedCount,
		};
	}

	/**
	 * Clear the cache.
	 */
	clearCache(): void {
		this.imageCache.clear();
		this.compressionQueue = [];
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
