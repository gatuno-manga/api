import { Logger } from '@nestjs/common';
import type { Page } from 'playwright';

/**
 * Helper for downloading images from a page using Playwright.
 */
export class ImageDownloader {
    private readonly logger = new Logger(ImageDownloader.name);

    constructor(private readonly page: Page) {}

    /**
     * Fetch an image as Buffer using Playwright's request context.
     * More efficient than base64 conversion.
     */
    async fetchImageAsBuffer(imageUrl: string): Promise<Buffer | null> {
        try {
            const context = this.page.context();
            const response = await context.request.get(imageUrl);

            if (!response.ok()) {
                this.logger.warn(`HTTP ${response.status()} for: ${imageUrl}`);
                return null;
            }

            return await response.body();
        } catch (error) {
            this.logger.error(`Failed to fetch image as buffer: ${imageUrl}`, error);
            return null;
        }
    }

    /**
     * Fetch an image as base64 string.
     * @deprecated Use fetchImageAsBuffer for better performance
     */
    async fetchImageAsBase64(imageUrl: string): Promise<string | null> {
        try {
            const base64 = await this.page.evaluate(async (url: string) => {
                try {
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    const blob = await response.blob();
                    return new Promise<string | null>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const result = reader.result as string;
                            resolve(result.split(',')[1] || null);
                        };
                        reader.onerror = () => resolve(null);
                        reader.readAsDataURL(blob);
                    });
                } catch {
                    return null;
                }
            }, imageUrl);

            return base64;
        } catch (error) {
            this.logger.error(`Failed to fetch image: ${imageUrl}`, error);
            return null;
        }
    }

    /**
     * Get all image URLs from the page matching the selector.
     */
    async getImageUrls(selector = 'img'): Promise<string[]> {
        return await this.page.$$eval(selector, (imgs) =>
            (imgs as HTMLImageElement[])
                .map((img) => img.src)
                .filter(
                    (src) =>
                        src &&
                        (src.startsWith('http://') ||
                            src.startsWith('https://') ||
                            src.startsWith('blob:')),
                ),
        );
    }

    /**
     * Get URLs of images that failed to load.
     */
    async getFailedImageUrls(selector = 'img'): Promise<string[]> {
        return await this.page.$$eval(selector, (imgs) =>
            (imgs as HTMLImageElement[])
                .filter((img) => img.complete && img.naturalWidth === 0)
                .map((img) => img.src),
        );
    }

    /**
     * Wait for all images matching the selector to load.
     */
    async waitForAllImagesLoaded(
        selector = 'img',
        timeout = 60000,
    ): Promise<void> {
        await this.page.waitForFunction(
            (sel: string) => {
                const images = document.querySelectorAll(sel) as NodeListOf<HTMLImageElement>;
                return Array.from(images).every((img) => img.complete);
            },
            selector,
            { timeout },
        );
    }

    /**
     * Download multiple images and return their base64 strings.
     */
    async downloadImages(
        imageUrls: string[],
        failedUrls: string[] = [],
    ): Promise<(string | null)[]> {
        const results: (string | null)[] = [];

        for (const imageUrl of imageUrls) {
            if (failedUrls.includes(imageUrl)) {
                this.logger.warn(`Image failed to load: ${imageUrl}`);
                results.push(null);
                continue;
            }

            const base64 = await this.fetchImageAsBase64(imageUrl);
            results.push(base64);
        }

        return results;
    }
}
