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
	 * @default 3000
	 */
	timeout?: number;

	/**
	 * Aguardar animações CSS terminarem
	 * @default false
	 */
	waitForAnimations?: boolean;

	/**
	 * Escala do screenshot (para retina displays)
	 * @default 'device'
	 */
	scale?: 'css' | 'device';

	/**
	 * Formato da imagem
	 * @default 'png'
	 */
	format?: 'png' | 'jpeg';

	/**
	 * Qualidade JPEG (0-100). Ignorado para PNG.
	 * @default 85
	 */
	quality?: number;

	/**
	 * Tamanho mínimo do elemento para capturar (ignora ícones pequenos)
	 * @default 50
	 */
	minSize?: number;

	/**
	 * Tempo de espera após scroll até o elemento (ms)
	 * @default 300
	 */
	scrollWaitMs?: number;

	/**
	 * Tempo de pausa entre scrolls no scroll agressivo (ms)
	 * @default 800
	 */
	scrollPauseMs?: number;
}

const DEFAULT_OPTIONS: Required<ElementScreenshotOptions> = {
	selector: 'img',
	timeout: 3000,
	waitForAnimations: false,
	scale: 'device',
	format: 'png',
	quality: 85,
	minSize: 50,
	scrollWaitMs: 300,
	scrollPauseMs: 800,
};

/**
 * Helper para captura de screenshots de elementos individuais.
 *
 * Otimizado baseado no fluxo Python que é 10x mais rápido.
 *
 * Casos de uso:
 * - Imagens renderizadas via canvas
 * - Sites com proteção contra download direto
 * - WebGL/SVG renderizados
 * - Lazy loading complexo
 * - Sites que bloqueiam requisições de imagem
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
	 * Captura screenshot de um único elemento (otimizado para velocidade)
	 * Inspirado no fluxo Python que é 10x mais rápido
	 */
	async captureElement(
		element: Locator,
		index?: number,
	): Promise<Buffer | null> {
		try {
			// Scroll direto até o elemento (sem verificações complexas)
			await this.scrollToElementFast(element, index);

			// Espera para renderização
			await this.page.waitForTimeout(this.options.scrollWaitMs);

			// Verificar se o elemento existe e tem tamanho
			let box = await element.boundingBox();

			// Se não tem bounding box, o elemento pode não estar renderizado ainda
			if (!box) {
				// Tentar scroll novamente e aguardar mais
				await this.scrollToElementFast(element, index);
				await this.page.waitForTimeout(this.options.scrollWaitMs * 2);
				box = await element.boundingBox();
				if (!box) {
					this.logger.debug(
						`Element ${index} has no bounding box after retry, skipping`,
					);
					return null;
				}
			}

			// Verificar tamanho mínimo (ignorar ícones pequenos)
			if (
				box.width < this.options.minSize ||
				box.height < this.options.minSize
			) {
				this.logger.debug(
					`Skipping small element: ${box.width}x${box.height}`,
				);
				return null;
			}

			// Capturar screenshot (PNG por padrão para máxima qualidade)
			const screenshotOptions: Parameters<Locator['screenshot']>[0] = {
				scale: this.options.scale,
				animations: this.options.waitForAnimations
					? 'disabled'
					: 'allow',
			};

			if (this.options.format === 'png') {
				screenshotOptions.type = 'png';
			} else {
				screenshotOptions.type = 'jpeg';
				screenshotOptions.quality = this.options.quality;
			}

			const screenshot = await element.screenshot(screenshotOptions);
			return screenshot;
		} catch (error) {
			this.logger.debug(`Failed to capture element ${index}: ${error}`);
			return null;
		}
	}

	/**
	 * Scroll rápido até o elemento (sem verificações de visibilidade)
	 */
	private async scrollToElementFast(
		element: Locator,
		index?: number,
	): Promise<void> {
		try {
			await element.evaluate((el) => {
				el.scrollIntoView({ behavior: 'instant', block: 'center' });
			});
		} catch {
			// Fallback: tentar pelo índice
			if (index !== undefined) {
				await this.page.evaluate(
					({ sel, idx }) => {
						const elements = document.querySelectorAll(sel);
						elements[idx]?.scrollIntoView({
							behavior: 'instant',
							block: 'center',
						});
					},
					{ sel: this.options.selector, idx: index },
				);
			}
		}
	}

	/**
	 * Captura screenshot de um elemento pelo índice
	 */
	async captureElementByIndex(index: number): Promise<Buffer | null> {
		const elements = this.page.locator(this.options.selector);
		const count = await elements.count();

		if (index >= count) {
			this.logger.warn(
				`Element index ${index} out of range (total: ${count})`,
			);
			return null;
		}

		return this.captureElement(elements.nth(index), index);
	}

	/**
	 * Captura screenshots de todos os elementos que correspondem ao seletor
	 * Scroll agressivo primeiro, depois captura elemento por elemento com scroll individual
	 */
	async captureAllElements(): Promise<Buffer[]> {
		const screenshots: Buffer[] = [];

		// Contagem ANTES do scroll (para comparar)
		const initialCount = await this.page
			.locator(this.options.selector)
			.count();
		this.logger.debug(
			`Initial count before scroll: ${initialCount} elements`,
		);

		// Scroll agressivo para carregar todas as imagens lazy-loaded
		await this.aggressiveScroll();

		// Espera extra após scroll para garantir que tudo carregou
		await this.page.waitForTimeout(1000);

		// Contagem DEPOIS do scroll
		const elements = this.page.locator(this.options.selector);
		const count = await elements.count();
		this.logger.log(
			`Found ${count} elements after scroll (was ${initialCount} before)`,
		);

		if (count === 0) {
			this.logger.warn('No elements found after scroll!');
			return screenshots;
		}

		// Captura sequencial - para cada elemento, scroll até ele e captura
		for (let i = 0; i < count; i++) {
			const element = elements.nth(i);
			const screenshot = await this.captureElement(element, i);

			if (screenshot) {
				screenshots.push(screenshot);
			}
		}

		this.logger.log(
			`Captured ${screenshots.length}/${count} element screenshots`,
		);
		return screenshots;
	}

	/**
	 * Scroll agressivo para carregar todas as imagens lazy-loaded.
	 *
	 * Baseado no método Python que funciona corretamente:
	 * 1. Usa mouse.wheel() em vez de window.scrollBy()
	 * 2. Pressiona 'End' para destravar lazy loads
	 * 3. Faz scroll de volta para carregar elementos do meio
	 */
	private async aggressiveScroll(): Promise<void> {
		this.logger.debug('Starting aggressive scroll...');
		const scrollPauseMs = this.options.scrollPauseMs;

		// Clicar no body para garantir foco (igual Python)
		try {
			await this.page.click('body', { timeout: 1000 });
		} catch {
			/* ignore */
		}

		let lastHeight = await this.page.evaluate(
			() => document.body.scrollHeight,
		);
		let retries = 0;
		const maxRetries = 5;

		while (retries < maxRetries) {
			// Usar mouse.wheel como no Python (mais confiável que scrollBy)
			await this.page.mouse.wheel(0, 5000);
			await this.page.waitForTimeout(scrollPauseMs);

			const newHeight = await this.page.evaluate(
				() => document.body.scrollHeight,
			);

			if (newHeight > lastHeight) {
				lastHeight = newHeight;
				retries = 0;
				this.logger.debug(`Scroll: page grew to ${newHeight}px`);
			} else {
				retries++;
				// Pequeno scroll para cima para destravar lazy loads
				await this.page.mouse.wheel(0, -200);
				await this.page.waitForTimeout(300);
				// Pressionar End para forçar scroll ao final (igual Python)
				await this.page.keyboard.press('End');
				await this.page.waitForTimeout(500);
			}
		}

		// Scroll de volta ao topo lentamente para carregar elementos do meio
		const totalHeight = await this.page.evaluate(
			() => document.body.scrollHeight,
		);
		const viewportHeight = await this.page.evaluate(
			() => window.innerHeight,
		);
		let position = totalHeight;

		while (position > 0) {
			position -= viewportHeight;
			await this.page.evaluate(
				(pos) => window.scrollTo(0, pos),
				Math.max(0, position),
			);
			await this.page.waitForTimeout(scrollPauseMs / 2);
		}

		// Voltar ao topo
		await this.page.evaluate(() => window.scrollTo(0, 0));
		await this.page.waitForTimeout(500);

		this.logger.debug('Aggressive scroll complete');
	}

	/**
	 * Captura screenshot de um canvas específico e retorna como base64
	 */
	async captureCanvasAsBase64(
		canvasSelector: string,
	): Promise<string | null> {
		try {
			// Método específico para canvas: extrair dados diretamente
			const base64 = await this.page.evaluate((selector) => {
				const canvas = document.querySelector(
					selector,
				) as HTMLCanvasElement;
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
		return screenshots.map((buffer) => buffer.toString('base64'));
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
			return await element.evaluate(
				(el) => el.tagName.toLowerCase() === 'canvas',
			);
		} catch {
			return false;
		}
	}

	/**
	 * Retorna a extensão do arquivo baseada no formato configurado
	 */
	getExtension(): string {
		return this.options.format === 'png' ? '.png' : '.jpg';
	}

	/**
	 * Conta quantos elementos correspondem ao seletor
	 */
	async getElementCount(): Promise<number> {
		return this.page.locator(this.options.selector).count();
	}
}
