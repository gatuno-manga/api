import { Page, Locator } from 'playwright';
import { Logger } from '@nestjs/common';

/**
 * Opções de configuração para captura de screenshots de elementos
 */
export interface ElementScreenshotOptions {
    /**
     * Seletor CSS para os elementos de imagem
     */
    selector?: string;

    /**
     * Timeout para esperar elemento ficar visível (ms)
     * @default 10000
     */
    timeout?: number;

    /**
     * Aguardar animações CSS terminarem
     * @default true
     */
    waitForAnimations?: boolean;

    /**
     * Escala do screenshot (para retina displays)
     * @default 'device'
     */
    scale?: 'css' | 'device';

    /**
     * Formato da imagem (sempre PNG para máxima qualidade)
     * @default 'png'
     */
    format?: 'png';
}

const DEFAULT_OPTIONS: Required<ElementScreenshotOptions> = {
    selector: 'img',
    timeout: 10000,
    waitForAnimations: true,
    scale: 'device',
    format: 'png',
};

/**
 * Helper para captura de screenshots de elementos individuais.
 * Útil para:
 * - Imagens renderizadas via canvas
 * - Sites com proteção contra download
 * - WebGL/SVG renderizados
 * - Lazy loading complexo
 */
export class ElementScreenshot {
    private readonly logger = new Logger(ElementScreenshot.name);
    private readonly options: Required<ElementScreenshotOptions>;

    constructor(
        private readonly page: Page,
        options?: Partial<ElementScreenshotOptions>,
    ) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * Captura screenshot de um único elemento
     */
    async captureElement(element: Locator): Promise<Buffer | null> {
        try {
            // Aguardar elemento estar visível
            await element.waitFor({
                state: 'visible',
                timeout: this.options.timeout,
            });

            // Scroll até o elemento
            await element.scrollIntoViewIfNeeded();

            // Aguardar animações se configurado
            if (this.options.waitForAnimations) {
                await this.page.waitForTimeout(100);
            }

            // Capturar screenshot em PNG (lossless)
            const screenshot = await element.screenshot({
                type: 'png',
                scale: this.options.scale,
                animations: this.options.waitForAnimations ? 'disabled' : 'allow',
            });

            return screenshot;
        } catch (error) {
            this.logger.warn(`Failed to capture element screenshot: ${error}`);
            return null;
        }
    }

    /**
     * Captura screenshot de um elemento pelo índice
     */
    async captureElementByIndex(index: number): Promise<Buffer | null> {
        const elements = this.page.locator(this.options.selector);
        const count = await elements.count();

        if (index >= count) {
            this.logger.warn(`Element index ${index} out of range (total: ${count})`);
            return null;
        }

        return this.captureElement(elements.nth(index));
    }

    /**
     * Captura screenshots de todos os elementos que correspondem ao seletor
     */
    async captureAllElements(): Promise<Buffer[]> {
        const elements = this.page.locator(this.options.selector);
        const count = await elements.count();
        const screenshots: Buffer[] = [];

        this.logger.debug(`Found ${count} elements matching selector: ${this.options.selector}`);

        for (let i = 0; i < count; i++) {
            const element = elements.nth(i);
            const screenshot = await this.captureElement(element);

            if (screenshot) {
                screenshots.push(screenshot);
            }
        }

        this.logger.log(`Captured ${screenshots.length}/${count} element screenshots`);
        return screenshots;
    }

    /**
     * Captura screenshot de um canvas específico e retorna como base64
     */
    async captureCanvasAsBase64(canvasSelector: string): Promise<string | null> {
        try {
            // Método específico para canvas: extrair dados diretamente
            const base64 = await this.page.evaluate((selector) => {
                const canvas = document.querySelector(selector) as HTMLCanvasElement;
                if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
                    return null;
                }
                return canvas.toDataURL('image/png').split(',')[1];
            }, canvasSelector);

            if (base64) {
                return base64;
            }

            // Fallback: screenshot do elemento
            const element = this.page.locator(canvasSelector);
            const screenshot = await this.captureElement(element);
            return screenshot ? screenshot.toString('base64') : null;
        } catch (error) {
            this.logger.warn(`Failed to capture canvas: ${error}`);
            return null;
        }
    }

    /**
     * Captura todos os elementos e retorna como Buffers (mais eficiente)
     */
    async captureAllAsBuffers(): Promise<Buffer[]> {
        return this.captureAllElements();
    }

    /**
     * Captura todos os elementos e retorna como base64
     * @deprecated Use captureAllAsBuffers para melhor performance
     */
    async captureAllAsBase64(): Promise<string[]> {
        const screenshots = await this.captureAllElements();
        return screenshots.map(buffer => buffer.toString('base64'));
    }

    /**
     * Captura elemento específico e retorna como base64
     * @deprecated Use captureElement para melhor performance
     */
    async captureElementAsBase64(element: Locator): Promise<string | null> {
        const screenshot = await this.captureElement(element);
        return screenshot ? screenshot.toString('base64') : null;
    }

    /**
     * Verifica se um elemento é um canvas
     */
    async isCanvas(element: Locator): Promise<boolean> {
        try {
            return await element.evaluate(el => el.tagName.toLowerCase() === 'canvas');
        } catch {
            return false;
        }
    }

    /**
     * Aguarda imagens dentro de canvas serem renderizadas
     */
    async waitForCanvasRendering(timeout = 5000): Promise<void> {
        const startTime = Date.now();
        let lastDataLength = 0;

        while (Date.now() - startTime < timeout) {
            const currentLength = await this.page.evaluate((selector) => {
                const canvases = document.querySelectorAll(selector);
                let total = 0;
                canvases.forEach(canvas => {
                    if (canvas instanceof HTMLCanvasElement) {
                        try {
                            total += canvas.toDataURL().length;
                        } catch {
                            // Canvas tainted - ignore
                        }
                    }
                });
                return total;
            }, this.options.selector);

            if (currentLength > 0 && currentLength === lastDataLength) {
                // Canvas estabilizou
                return;
            }

            lastDataLength = currentLength;
            await this.page.waitForTimeout(200);
        }
    }

    /**
     * Retorna a extensão do arquivo (sempre .png)
     */
    getExtension(): string {
        return '.png';
    }

    /**
     * Conta quantos elementos correspondem ao seletor
     */
    async getElementCount(): Promise<number> {
        return this.page.locator(this.options.selector).count();
    }
}
