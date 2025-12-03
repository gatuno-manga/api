import { Logger } from '@nestjs/common';
import type { Page, Response, Route } from 'playwright';

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
 * Cached image data.
 */
export interface CachedImage {
    url: string;
    data: Buffer;
    contentType: string;
}

/**
 * Helper for intercepting network traffic and caching images.
 * This is more efficient than fetching images separately after the page loads.
 */
export class NetworkInterceptor {
    private readonly logger = new Logger(NetworkInterceptor.name);
    private readonly imageCache = new Map<string, CachedImage>();
    private isIntercepting = false;

    constructor(
        private readonly page: Page,
        private readonly filterConfig: UrlFilterConfig = {
            blacklistTerms: [],
            whitelistTerms: [],
        },
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
     * Handle a network response and cache image data.
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

            // Cache the image
            this.imageCache.set(url, {
                url,
                data: body,
                contentType,
            });

            this.logger.debug(
                `Cached image: ${url} (${body.length} bytes)`,
            );
        } catch (error) {
            // Silently ignore errors (response might be unavailable)
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
        let cached = this.imageCache.get(url);
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
     * Get a cached image as base64.
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
     * Get all cached image URLs.
     */
    getCachedUrls(): string[] {
        return Array.from(this.imageCache.keys());
    }

    /**
     * Get cache statistics.
     */
    getStats(): { count: number; totalBytes: number } {
        let totalBytes = 0;
        for (const image of this.imageCache.values()) {
            totalBytes += image.data.length;
        }
        return {
            count: this.imageCache.size,
            totalBytes,
        };
    }

    /**
     * Clear the cache.
     */
    clearCache(): void {
        this.imageCache.clear();
    }

    /**
     * Get file extension from content type or URL.
     */
    getExtension(url: string): string {
        const cached = this.getCachedImage(url);
        if (cached) {
            const contentType = cached.contentType.toLowerCase();
            if (contentType.includes('png')) return '.png';
            if (contentType.includes('webp')) return '.webp';
            if (contentType.includes('gif')) return '.gif';
            if (contentType.includes('svg')) return '.svg';
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
