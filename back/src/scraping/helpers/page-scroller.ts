import { Logger } from '@nestjs/common';
import type { Page } from 'playwright';
import { ComplexityMultipliers } from './page-complexity-detector';

/**
 * Configuration for page scrolling behavior.
 */
export interface ScrollConfig {
    /**
     * Pause between scrolls in milliseconds.
     * @default 800
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

    /**
     * Scroll step size in pixels. Uses viewport height if not set.
     * @default undefined (uses viewport height * 0.7)
     */
    scrollStep?: number;

    /**
     * Whether to use incremental scrolling (smoother, better for lazy loading)
     * @default true
     */
    useIncrementalScroll?: boolean;
}

export const DEFAULT_SCROLL_CONFIG: Required<ScrollConfig> = {
    scrollPauseMs: 800, // Aumentado de 300ms para 800ms para lazy-loading
    stabilityChecks: 5, // Aumentado de 2 para 5 para páginas longas
    maxImageRetries: 1,
    retryDelayMs: 500,
    imageSelector: 'img',
    scrollStep: 1200, // Reduzido de 3000px para 1200px para não pular conteúdo
    useIncrementalScroll: true,
};

/**
 * Aplica multiplicadores adaptativos à configuração de scroll baseado na complexidade da página
 *
 * @param baseConfig - Configuração base de scroll
 * @param multipliers - Multiplicadores de complexidade
 * @returns Configuração de scroll adaptada
 */
export function getAdaptiveScrollConfig(
    baseConfig: Required<ScrollConfig>,
    multipliers: ComplexityMultipliers,
): Required<ScrollConfig> {
    return {
        ...baseConfig,
        scrollPauseMs: Math.ceil(
            baseConfig.scrollPauseMs * multipliers.delayMultiplier,
        ),
        stabilityChecks: Math.ceil(
            baseConfig.stabilityChecks * multipliers.stabilityMultiplier,
        ),
        retryDelayMs: Math.ceil(
            baseConfig.retryDelayMs * multipliers.delayMultiplier,
        ),
        // Usa scrollStep adaptativo calculado baseado no tamanho da página
        scrollStep: multipliers.scrollStep,
    };
}

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
                    const retryCount = parseInt(
                        img.dataset.retryCount || '0',
                        10,
                    );
                    if (retryCount < config.maxImageRetries) {
                        img.dataset.retryCount = String(retryCount + 1);
                        setTimeout(() => {
                            const originalSrc =
                                img.dataset.originalSrc ||
                                img.src.split('?')[0];
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
                                img.onerror = () =>
                                    attemptImageReload(img, resolve);
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
                                        processNewImageNode(
                                            element as HTMLImageElement,
                                        );
                                    }
                                    element
                                        .querySelectorAll(config.imageSelector)
                                        .forEach((img) =>
                                            processNewImageNode(
                                                img as HTMLImageElement,
                                            ),
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
                    .forEach((img) =>
                        processNewImageNode(img as HTMLImageElement),
                    );

                // First, scroll to top to ensure cover/header images load
                window.scrollTo(0, 0);
                await new Promise((resolve) => setTimeout(resolve, 500));

                // Calculate scroll step
                const viewportHeight = window.innerHeight;
                const scrollStep =
                    config.scrollStep > 0
                        ? config.scrollStep
                        : Math.floor(viewportHeight * 0.7);

                if (config.useIncrementalScroll) {
                    // Scroll incremental adaptativo
                    let lastHeight = document.body.scrollHeight;
                    let retries = 0;

                    while (retries < config.stabilityChecks) {
                        // Scroll para baixo
                        window.scrollBy(0, scrollStep);

                        await new Promise((resolve) =>
                            setTimeout(resolve, config.scrollPauseMs),
                        );

                        const newHeight = document.body.scrollHeight;

                        if (newHeight > lastHeight) {
                            lastHeight = newHeight;
                            retries = 0;
                        } else {
                            retries++;
                            // Pequeno scroll reverso para destravar lazy loads
                            window.scrollBy(0, -200);
                            await new Promise((resolve) =>
                                setTimeout(resolve, 100),
                            );
                        }
                    }

                    // Over-scroll: tentar ir além do final por ~2s para detectar infinite scroll
                    // Útil para sites que carregam mais conteúdo quando você tenta scrollar além do fim
                    const overScrollAttempts = 4; // 4 tentativas × 500ms = 2 segundos
                    let overScrollCount = 0;

                    while (overScrollCount < overScrollAttempts) {
                        const heightBeforeOverScroll =
                            document.body.scrollHeight;

                        // Força scroll além do final (mesmo que já esteja no bottom)
                        window.scrollTo(0, document.body.scrollHeight + 1000);
                        await new Promise((resolve) =>
                            setTimeout(resolve, 500),
                        );

                        const heightAfterOverScroll =
                            document.body.scrollHeight;

                        if (heightAfterOverScroll > heightBeforeOverScroll) {
                            // Nova página carregou! Resetar contadores e continuar scrolling normal
                            lastHeight = heightAfterOverScroll;
                            retries = 0;
                            overScrollCount = 0;

                            // Continuar scroll incremental na nova seção
                            let newContentRetries = 0;
                            while (newContentRetries < config.stabilityChecks) {
                                window.scrollBy(0, scrollStep);
                                await new Promise((resolve) =>
                                    setTimeout(resolve, config.scrollPauseMs),
                                );

                                const currentHeight =
                                    document.body.scrollHeight;
                                if (currentHeight > lastHeight) {
                                    lastHeight = currentHeight;
                                    newContentRetries = 0;
                                } else {
                                    newContentRetries++;
                                }
                            }
                            // Depois de processar novo conteúdo, tentar over-scroll novamente
                        } else {
                            // Nada novo carregou, incrementar contador
                            overScrollCount++;
                        }
                    }
                } else {
                    // Original behavior - jump to bottom
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
                }

                // Scroll back to top briefly to ensure top elements are visible
                window.scrollTo(0, 0);
                await new Promise((resolve) => setTimeout(resolve, 300));

                // Wait for all images to finish processing
                await Promise.all(imageProcessingPromises);

                // Delay adicional antes de disconnect para evitar race condition com lazy-loads tardios
                await new Promise((resolve) => setTimeout(resolve, 2000));
                observer.disconnect();

                // Collect failed images
                const failedImages = Array.from(
                    document.querySelectorAll(
                        `${config.imageSelector}[data-failed="true"]`,
                    ),
                ).map(
                    (img) =>
                        (img as HTMLImageElement).dataset.originalSrc || '',
                );

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
