import { Page } from 'playwright';

/**
 * Métricas de complexidade da página
 */
export interface PageComplexity {
	/** Altura total da página em pixels */
	scrollHeight: number;
	/** Número de elementos de imagem na página */
	elementCount: number;
	/** Altura da viewport em pixels */
	viewportHeight: number;
	/** Razão entre altura total e viewport (scrollHeight / viewportHeight) */
	scrollRatio: number;
	/** Número estimado de scrolls necessários */
	estimatedScrolls: number;
	/** Classificação do tamanho da página */
	pageSize: PageSize;
}

/**
 * Classificação de tamanho de página baseado no scroll ratio
 */
export enum PageSize {
	/** Página pequena: < 3 viewports */
	SMALL = 'small',
	/** Página média: 3-10 viewports */
	MEDIUM = 'medium',
	/** Página grande: 10-30 viewports */
	LARGE = 'large',
	/** Página enorme: > 30 viewports */
	HUGE = 'huge',
}

/**
 * Multiplicadores de timeout baseados no tamanho da página
 */
export interface ComplexityMultipliers {
	/** Multiplicador para scrollPauseMs e delays gerais */
	delayMultiplier: number;
	/** Multiplicador para stabilityChecks */
	stabilityMultiplier: number;
	/** Multiplicador para timeouts gerais */
	timeoutMultiplier: number;
	/** ScrollStep adaptativo em pixels */
	scrollStep: number;
}

/**
 * Detecta a complexidade de uma página baseado em métricas de scroll e elementos
 *
 * @param page - Página do Playwright
 * @param imageSelector - Seletor para contar elementos (default: 'img')
 * @returns Objeto com métricas de complexidade da página
 */
export async function detectPageComplexity(
	page: Page,
	imageSelector = 'img',
): Promise<PageComplexity> {
	const metrics = await page.evaluate((selector) => {
		const scrollHeight = document.body.scrollHeight;
		const viewportHeight = window.innerHeight;
		const elementCount = document.querySelectorAll(selector).length;

		const scrollRatio = scrollHeight / viewportHeight;
		const estimatedScrolls = Math.ceil(scrollRatio);

		return {
			scrollHeight,
			viewportHeight,
			elementCount,
			scrollRatio,
			estimatedScrolls,
		};
	}, imageSelector);

	// Classifica o tamanho da página baseado no scroll ratio
	let pageSize: PageSize;
	if (metrics.scrollRatio < 3) {
		pageSize = PageSize.SMALL;
	} else if (metrics.scrollRatio < 10) {
		pageSize = PageSize.MEDIUM;
	} else if (metrics.scrollRatio < 30) {
		pageSize = PageSize.LARGE;
	} else {
		pageSize = PageSize.HUGE;
	}

	return {
		...metrics,
		pageSize,
	};
}

/**
 * Retorna multiplicadores de timeout baseado na complexidade da página
 *
 * @param complexity - Métricas de complexidade da página
 * @param customMultipliers - Multiplicadores customizados por tamanho (opcional)
 * @returns Multiplicadores para aplicar em timeouts e delays
 */
export function getComplexityMultipliers(
	complexity: PageComplexity,
	customMultipliers?: Record<PageSize, number>,
): ComplexityMultipliers {
	// Multiplicadores padrão por tamanho de página
	const defaultMultipliers: Record<PageSize, number> = {
		[PageSize.SMALL]: 1.0,
		[PageSize.MEDIUM]: 1.5,
		[PageSize.LARGE]: 2.0,
		[PageSize.HUGE]: 3.0,
	};

	// Usa multiplicadores customizados se fornecidos, senão usa os padrão
	const multipliers = customMultipliers || defaultMultipliers;
	const baseMultiplier = multipliers[complexity.pageSize];

	// ScrollStep adaptativo: páginas pequenas scrollam mais rápido
	const scrollStep = getAdaptiveScrollStep(
		complexity.pageSize,
		complexity.viewportHeight,
	);

	return {
		delayMultiplier: baseMultiplier,
		stabilityMultiplier: baseMultiplier,
		timeoutMultiplier: baseMultiplier,
		scrollStep,
	};
}

/**
 * Calcula o scrollStep ideal baseado no tamanho da página
 * Páginas pequenas: scroll rápido (viewport completo)
 * Páginas grandes: scroll cuidadoso (50-70% viewport) para capturar todos os lazy-loads
 *
 * @param pageSize - Classificação do tamanho da página
 * @param viewportHeight - Altura da viewport em pixels
 * @returns ScrollStep em pixels
 */
export function getAdaptiveScrollStep(
	pageSize: PageSize,
	viewportHeight: number,
): number {
	switch (pageSize) {
		case PageSize.SMALL:
			// Página pequena: scroll rápido (viewport completo)
			// Lazy-loading simples não precisa de sobreposição
			return Math.floor(viewportHeight * 1.0); // 100% = ~1080px
		case PageSize.MEDIUM:
			// Página média: scroll moderado (70% viewport)
			// Captura detection zones sem ser muito lento
			return Math.floor(viewportHeight * 0.7); // 70% = ~756px
		case PageSize.LARGE:
			// Página grande: scroll cuidadoso (50% viewport)
			// Garante sobreposição para lazy-loads complexos
			return Math.floor(viewportHeight * 0.5); // 50% = ~540px
		case PageSize.HUGE:
			// Página enorme: scroll muito cuidadoso (50% viewport)
			// Máxima garantia de captura com infinite scroll
			return Math.floor(viewportHeight * 0.5); // 50% = ~540px
		default:
			return 800; // Fallback
	}
}
