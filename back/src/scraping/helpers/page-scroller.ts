import { Logger } from '@nestjs/common';
import type { Page } from 'playwright';

/**
 * Configuration for page scrolling behavior.
 */
export interface ScrollConfig {
    /**
     * Pause between scrolls in milliseconds.
     * @default 1500
     */
    scrollPauseMs?: number;

    /**
     * Number of stability checks before considering scroll complete.
     * @default 3
     */
    stabilityChecks?: number;

    /**
     * Maximum retries for failed images.
     * @default 3
     */
    maxImageRetries?: number;

    /**
     * Delay between image retry attempts in milliseconds.
     * @default 1000
     */
    retryDelayMs?: number;

    /**
     * Selector for images to track.
     * @default 'img'
     */
    imageSelector?: string;
}

const DEFAULT_SCROLL_CONFIG: Required<ScrollConfig> = {
    scrollPauseMs: 1500,
    stabilityChecks: 3,
    maxImageRetries: 3,
    retryDelayMs: 1000,
    imageSelector: 'img',
};

/**
 * Result from scroll operation.
 */
export interface ScrollResult {
    processedImageCount: number;
    failedImageCount: number;
    failedImages: string[];
}

/**
 * Helper for scrolling pages and waiting for lazy-loaded content.
 */
export class PageScroller {
    private readonly logger = new Logger(PageScroller.name);
    private readonly config: Required<ScrollConfig>;

    constructor(
        private readonly page: Page,
        config?: ScrollConfig,
    ) {
        this.config = { ...DEFAULT_SCROLL_CONFIG, ...config };
    }

    /**
     * Scroll to the bottom of the page, waiting for lazy-loaded images.
     * Returns information about processed images.
     */
    async scrollAndWait(): Promise<ScrollResult> {
        this.logger.debug('Starting scroll and wait process...');

        const result = await this.page.evaluate(
            async (config: Required<ScrollConfig>) => {
                const imageProcessingPromises: Promise<void>[] = [];
                let processedImageCount = 0;
                const processedImages = new Set<HTMLImageElement>();

                // Retry logic for failed images
                function attemptImageReload(
                    img: HTMLImageElement,
                    resolve: () => void,
                ): void {
                    const retryCount = parseInt(img.dataset.retryCount || '0', 10);
                    if (retryCount < config.maxImageRetries) {
                        img.dataset.retryCount = String(retryCount + 1);
                        setTimeout(() => {
                            const originalSrc =
                                img.dataset.originalSrc || img.src.split('?')[0];
                            img.src = `${originalSrc}?retry=${Date.now()}`;
                        }, config.retryDelayMs * retryCount);
                    } else {
                        img.dataset.failed = 'true';
                        resolve();
                    }
                }

                // Process a new image node
                function processNewImageNode(img: HTMLImageElement): void {
                    if (processedImages.has(img)) return;
                    processedImages.add(img);
                    processedImageCount++;

                    if (!img.src) return;
                    img.dataset.originalSrc = img.src.split('?')[0];

                    const promise = new Promise<void>((resolve) => {
                        const checkImage = () => {
                            if (img.complete) {
                                if (img.naturalWidth > 0) {
                                    resolve();
                                } else {
                                    attemptImageReload(img, resolve);
                                }
                            } else {
                                img.onload = () => resolve();
                                img.onerror = () => attemptImageReload(img, resolve);
                            }
                        };
                        checkImage();
                    });
                    imageProcessingPromises.push(promise);
                }

                // Set up mutation observer for new images
                const observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        if (mutation.type === 'childList') {
                            for (const node of mutation.addedNodes) {
                                if (node.nodeType === 1) {
                                    const element = node as Element;
                                    if (element.matches(config.imageSelector)) {
                                        processNewImageNode(element as HTMLImageElement);
                                    }
                                    element
                                        .querySelectorAll(config.imageSelector)
                                        .forEach((img) =>
                                            processNewImageNode(img as HTMLImageElement),
                                        );
                                }
                            }
                        } else if (
                            mutation.type === 'attributes' &&
                            mutation.attributeName === 'src'
                        ) {
                            const target = mutation.target as Element;
                            if (target?.matches(config.imageSelector)) {
                                processNewImageNode(target as HTMLImageElement);
                            }
                        }
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['src'],
                });

                // Process existing images
                document
                    .querySelectorAll(config.imageSelector)
                    .forEach((img) => processNewImageNode(img as HTMLImageElement));

                // Scroll to bottom
                let lastHeight = 0;
                let stableChecks = 0;

                while (stableChecks < config.stabilityChecks) {
                    lastHeight = document.body.scrollHeight;
                    window.scrollTo(0, document.body.scrollHeight);
                    await new Promise((resolve) =>
                        setTimeout(resolve, config.scrollPauseMs),
                    );
                    const newHeight = document.body.scrollHeight;
                    if (newHeight === lastHeight) {
                        stableChecks++;
                    } else {
                        stableChecks = 0;
                    }
                }

                // Wait for all images to finish processing
                await Promise.all(imageProcessingPromises);
                observer.disconnect();

                // Collect failed images
                const failedImages = Array.from(
                    document.querySelectorAll(
                        `${config.imageSelector}[data-failed="true"]`,
                    ),
                ).map((img) => (img as HTMLImageElement).dataset.originalSrc || '');

                return {
                    processedImageCount,
                    failedImageCount: failedImages.length,
                    failedImages,
                };
            },
            this.config,
        );

        this.logger.debug(
            `Scroll complete. Processed: ${result.processedImageCount}, Failed: ${result.failedImageCount}`,
        );

        return result;
    }

    /**
     * Simple scroll to bottom without image tracking.
     */
    async scrollToBottom(): Promise<void> {
        await this.page.evaluate(async (pauseMs: number) => {
            let lastHeight = 0;
            let stableChecks = 0;

            while (stableChecks < 3) {
                lastHeight = document.body.scrollHeight;
                window.scrollTo(0, document.body.scrollHeight);
                await new Promise((resolve) => setTimeout(resolve, pauseMs));
                if (document.body.scrollHeight === lastHeight) {
                    stableChecks++;
                } else {
                    stableChecks = 0;
                }
            }
        }, this.config.scrollPauseMs);
    }

    /**
     * Scroll to a specific element.
     */
    async scrollToElement(selector: string): Promise<void> {
        await this.page.locator(selector).scrollIntoViewIfNeeded();
    }
}
