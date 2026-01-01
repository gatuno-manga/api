import { Logger } from '@nestjs/common';
import type { Page } from 'playwright';

/**
 * Configuração de filtro de URLs para ImageDownloader
 */
export interface UrlFilterConfig {
    blacklistTerms: string[];
    whitelistTerms: string[];
}

/**
 * Helper for downloading images from a page using Playwright.
 */
export class ImageDownloader {
    private readonly logger = new Logger(ImageDownloader.name);
    private readonly filterConfig: UrlFilterConfig;

    constructor(
        private readonly page: Page,
        filterConfig?: Partial<UrlFilterConfig>,
    ) {
        this.filterConfig = {
            blacklistTerms: filterConfig?.blacklistTerms || [],
            whitelistTerms: filterConfig?.whitelistTerms || [],
        };
    }

    /**
     * Verifica se uma URL deve ser aceita baseado nos filtros de blacklist/whitelist.
     */
    private shouldAcceptUrl(url: string): boolean {
        const lowerUrl = url.toLowerCase();

        // Verifica blacklist primeiro
        if (this.filterConfig.blacklistTerms.length > 0) {
            for (const term of this.filterConfig.blacklistTerms) {
                if (lowerUrl.includes(term.toLowerCase())) {
                    return false;
                }
            }
        }

        // Verifica whitelist (se configurada)
        if (this.filterConfig.whitelistTerms.length > 0) {
            for (const term of this.filterConfig.whitelistTerms) {
                if (lowerUrl.includes(term.toLowerCase())) {
                    return true;
                }
            }
            // Whitelist configurada mas URL não corresponde a nenhum termo
            this.logger.log(
                `🚫 Whitelist rejeitou: ${url} (nenhum termo correspondeu)`,
            );
            return false;
        }

        // Sem whitelist configurada, aceita todas URLs não-blacklisted
        return true;
    }

    /**
     * Fetch an image as Buffer using Playwright's request context.
     * More efficient than base64 conversion.
     * Note: This may fail with 403 if the site checks Referer headers.
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
            this.logger.error(
                `Failed to fetch image as buffer: ${imageUrl}`,
                error,
            );
            return null;
        }
    }

    /**
     * Fetch an image as Buffer using page.evaluate with fetch.
     * This method inherits cookies and Referer headers from the page context,
     * which is useful for sites that check Referer headers.
     */
    async fetchImageViaPageContext(imageUrl: string): Promise<Buffer | null> {
        try {
            const base64 = await this.page.evaluate(async (url: string) => {
                try {
                    const response = await fetch(url, {
                        credentials: 'include',
                    });
                    if (!response.ok) {
                        return null;
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

            if (!base64) {
                this.logger.warn(
                    `Failed to fetch via page context: ${imageUrl}`,
                );
                return null;
            }

            return Buffer.from(base64, 'base64');
        } catch (error) {
            this.logger.error(
                `Failed to fetch image via page context: ${imageUrl}`,
                error,
            );
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
     * Aplica filtros de blacklist/whitelist se configurados.
     */
    async getImageUrls(selector = 'img'): Promise<string[]> {
        const allUrls = await this.page.$$eval(selector, (imgs) =>
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

        // Aplica filtros de blacklist/whitelist
        this.logger.log(`🔍 Processando ${allUrls.length} URLs encontradas...`);
        const filteredUrls = allUrls.filter((url) => this.shouldAcceptUrl(url));

        const rejected = allUrls.length - filteredUrls.length;
        this.logger.log(
            `📊 Resultado do filtro: ${filteredUrls.length} aceitas, ${rejected} rejeitadas (total: ${allUrls.length})`,
        );

        if (rejected === 0 && this.filterConfig.blacklistTerms.length > 0) {
            this.logger.warn(
                `⚠️ ATENÇÃO: Nenhuma URL foi rejeitada pela blacklist! ` +
                `Verifique se os termos estão corretos: ${JSON.stringify(this.filterConfig.blacklistTerms)}`,
            );
        }

        return filteredUrls;
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
                const images = document.querySelectorAll(sel);
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
