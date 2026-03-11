/**
 * Stress tests para garantir que as correções de memória do NetworkInterceptor
 * funcionam corretamente sob alta carga.
 *
 * Cada grupo de testes cobre uma das três causas do OOM:
 *
 *  [A] Back-pressure in-flight: buffers aguardando slot de compressão são
 *      contabilizados contra o maxCacheSize, impedindo acúmulo ilimitado.
 *
 *  [B] compressionQueue auto-limpeza: o Set remove entradas resolvidas
 *      automaticamente, não cresce indefinidamente como o array antigo.
 *
 *  [C] Sem vazamento entre sessões: após clearCache() o estado é zero.
 *
 *  [D] clearCache() interrompe tarefas em voo via flag _cleared.
 *
 *  [E] Alta concorrência: flood de 10.000 respostas simultâneas.
 *
 *  [F] Upload de páginas pesadas: simula capítulos reais com 50-300 páginas
 *      de alta resolução, forçando o GC e verificando que memória não cresce.
 */

// Permite usar --expose-gc via: node --expose-gc
declare const global: typeof globalThis & { gc?: () => void };

import { NetworkInterceptor } from './network-interceptor';

const MB = 1024 * 1024;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Cria um objeto fake que imita um Playwright Response de imagem.
 */
function makeImageResponse(
	url: string,
	sizeBytes: number,
	contentType = 'image/jpeg',
): any {
	const body = Buffer.alloc(sizeBytes, 1);
	return {
		request: () => ({ resourceType: () => 'image' }),
		ok: () => true,
		url: () => url,
		body: jest.fn(() => Promise.resolve(body)),
		headers: () => ({ 'content-type': contentType }),
	};
}

/**
 * Cria um compressor mockado com uma "trava" (latch):
 * todas as chamadas a compress() ficam suspensas até release() ser chamado.
 * Isso mantém inFlightBytes elevado durante a janela de verificação.
 */
function makeLatchCompressor(): {
	compressor: { compress: jest.Mock; getOutputExtension: jest.Mock };
	release: () => void;
} {
	const waiters: Array<() => void> = [];
	let released = false;

	return {
		compressor: {
			compress: jest.fn(async (buf: Buffer): Promise<Buffer> => {
				if (!released) {
					await new Promise<void>((r) => waiters.push(r));
				}
				// Simula compressão de 50%
				return Buffer.alloc(Math.floor(buf.length / 2), 2);
			}),
			getOutputExtension: jest.fn(() => '.webp'),
		},
		release: () => {
			released = true;
			for (const r of waiters.splice(0)) r();
		},
	};
}

/** Compressor rápido (imediato, sem latch). */
function makeFastCompressor() {
	return {
		compress: jest.fn(
			async (buf: Buffer): Promise<Buffer> =>
				Buffer.alloc(Math.floor(buf.length / 2), 2),
		),
		getOutputExtension: jest.fn(() => '.webp'),
	};
}

/**
 * Dispara múltiplos handleResponse concorrentemente
 * (acessando o método privado via cast).
 */
async function fireResponses(
	interceptor: NetworkInterceptor,
	responses: ReturnType<typeof makeImageResponse>[],
): Promise<void> {
	await Promise.all(
		responses.map((r) => (interceptor as any).handleResponse(r)),
	);
}

// Atalho para acessar internals do interceptor
const internal = (interceptor: NetworkInterceptor) => interceptor as any;

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe('NetworkInterceptor – gestão de memória (stress tests)', () => {
	let mockPage: any;

	beforeEach(() => {
		mockPage = {
			on: jest.fn(),
			off: jest.fn(),
		};
	});

	// =========================================================================
	// [A] Back-pressure: limite in-flight + cache
	// =========================================================================
	describe('[A] Back-pressure: in-flight + cache nunca excede maxCacheSize', () => {
		it('deve aceitar exatamente floor(maxCacheSize / imageSize) imagens ao receber 10 simultâneas', async () => {
			// maxCacheSize = 9 MB, imagem = 3 MB → apenas 3 cabem (9/3 = 3)
			// A 4ª já somaria 9 + 3 = 12 MB > 9 MB → descartada
			const MAX = 9 * MB;
			const IMG = 3 * MB;
			const TOTAL = 10;
			const EXPECTED = Math.floor(MAX / IMG); // 3

			const { compressor, release } = makeLatchCompressor();

			// Concorrência alta para que o slot nunca seja gargalo neste teste
			const interceptor = new NetworkInterceptor(
				mockPage,
				{ blacklistTerms: [], whitelistTerms: [] },
				compressor,
				{ maxCacheSize: MAX },
				100,
			);
			await interceptor.startInterception();

			const responses = Array.from({ length: TOTAL }, (_, i) =>
				makeImageResponse(`https://cdn.example.com/img${i}.jpg`, IMG),
			);

			await fireResponses(interceptor, responses);

			// Com latch ativo, compress() foi chamado para cada imagem ACEITA
			// antes de nossa continuação (o compressAndCache executa até o
			// primeiro `await compress()` dentro do microtask queue)
			expect(compressor.compress).toHaveBeenCalledTimes(EXPECTED);

			// A fila ainda tem as tarefas ativas (latch não liberado)
			expect(internal(interceptor).compressionQueue.size).toBe(EXPECTED);

			// Libera e aguarda conclusão
			release();
			await interceptor.waitForCompressions();

			expect(internal(interceptor).compressionQueue.size).toBe(0);
			expect(internal(interceptor).inFlightBytes).toBe(0);

			await interceptor.clearCache();
		});

		it('deve descartar imagens excedentes mesmo com imageSize fracionando maxCacheSize irregularmente', async () => {
			// maxCacheSize = 10 MB, imagens de 3 MB → floor(10/3) = 3 cabem
			const MAX = 10 * MB;
			const IMG = 3 * MB;
			const TOTAL = 15;
			const EXPECTED = Math.floor(MAX / IMG); // 3

			const { compressor, release } = makeLatchCompressor();

			const interceptor = new NetworkInterceptor(
				mockPage,
				{ blacklistTerms: [], whitelistTerms: [] },
				compressor,
				{ maxCacheSize: MAX },
				100,
			);
			await interceptor.startInterception();

			await fireResponses(
				interceptor,
				Array.from({ length: TOTAL }, (_, i) =>
					makeImageResponse(
						`https://cdn.example.com/img${i}.jpg`,
						IMG,
					),
				),
			);

			expect(compressor.compress).toHaveBeenCalledTimes(EXPECTED);
			expect(internal(interceptor).compressionQueue.size).toBe(EXPECTED);

			release();
			await interceptor.waitForCompressions();
			expect(internal(interceptor).compressionQueue.size).toBe(0);

			await interceptor.clearCache();
		});

		it('deve garantir inFlight = 0 após todas as compressões terminarem', async () => {
			const { compressor, release } = makeLatchCompressor();

			const interceptor = new NetworkInterceptor(
				mockPage,
				{ blacklistTerms: [], whitelistTerms: [] },
				compressor,
				{ maxCacheSize: 20 * MB },
				100,
			);
			await interceptor.startInterception();

			await fireResponses(
				interceptor,
				Array.from({ length: 10 }, (_, i) =>
					makeImageResponse(
						`https://cdn.example.com/img${i}.jpg`,
						MB,
					),
				),
			);

			// Antes de liberar
			expect(internal(interceptor).inFlightBytes).toBe(0); // decrementado pelo compressAndCache
			expect(internal(interceptor).compressionQueue.size).toBe(10); // ainda suspenso no compress()

			release();
			await interceptor.waitForCompressions();

			expect(internal(interceptor).inFlightBytes).toBe(0);
			expect(internal(interceptor).compressionQueue.size).toBe(0);

			await interceptor.clearCache();
		});
	});

	// =========================================================================
	// [B] compressionQueue: auto-limpeza
	// =========================================================================
	describe('[B] compressionQueue auto-limpeza', () => {
		it('deve estar vazio após waitForCompressions() com compressor rápido', async () => {
			const compressor = makeFastCompressor();

			const interceptor = new NetworkInterceptor(
				mockPage,
				{ blacklistTerms: [], whitelistTerms: [] },
				compressor,
				{ maxCacheSize: 50 * MB },
				4,
			);
			await interceptor.startInterception();

			await fireResponses(
				interceptor,
				Array.from({ length: 20 }, (_, i) =>
					makeImageResponse(
						`https://cdn.example.com/img${i}.jpg`,
						MB,
					),
				),
			);
			await interceptor.waitForCompressions();

			// O Set se auto-limpa via .finally() em cada promessa
			expect(internal(interceptor).compressionQueue.size).toBe(0);
			expect(internal(interceptor).inFlightBytes).toBe(0);

			await interceptor.clearCache();
		});

		it('deve crescer com latch ativo e cair para 0 ao liberar', async () => {
			const { compressor, release } = makeLatchCompressor();
			const NUM_IMAGES = 10;

			const interceptor = new NetworkInterceptor(
				mockPage,
				{ blacklistTerms: [], whitelistTerms: [] },
				compressor,
				{ maxCacheSize: 50 * MB },
				100,
			);
			await interceptor.startInterception();

			await fireResponses(
				interceptor,
				Array.from({ length: NUM_IMAGES }, (_, i) =>
					makeImageResponse(
						`https://cdn.example.com/img${i}.jpg`,
						MB,
					),
				),
			);

			// Latch retido: fila contém as 10 tarefas ativas
			expect(internal(interceptor).compressionQueue.size).toBe(
				NUM_IMAGES,
			);

			release();
			await interceptor.waitForCompressions();

			// Após liberar: cada .finally() remove do Set
			expect(internal(interceptor).compressionQueue.size).toBe(0);

			await interceptor.clearCache();
		});

		it('deve permanecer em 0 após múltiplas rodadas de compressão', async () => {
			const compressor = makeFastCompressor();

			const interceptor = new NetworkInterceptor(
				mockPage,
				{ blacklistTerms: [], whitelistTerms: [] },
				compressor,
				{ maxCacheSize: 100 * MB },
				4,
			);
			await interceptor.startInterception();

			// 3 rodadas de 10 imagens
			for (let round = 0; round < 3; round++) {
				await fireResponses(
					interceptor,
					Array.from({ length: 10 }, (_, i) =>
						makeImageResponse(
							`https://cdn.example.com/r${round}-img${i}.jpg`,
							MB,
						),
					),
				);
				await interceptor.waitForCompressions();

				expect(internal(interceptor).compressionQueue.size).toBe(0);
			}

			await interceptor.clearCache();
		});
	});

	// =========================================================================
	// [C] Sem vazamento entre sessões
	// =========================================================================
	describe('[C] Sem vazamento de memória entre sessões', () => {
		it('deve zerar completamente após clearCache() em 100 sessões consecutivas', async () => {
			const compressor = makeFastCompressor();

			for (let session = 0; session < 100; session++) {
				const interceptor = new NetworkInterceptor(
					mockPage,
					{ blacklistTerms: [], whitelistTerms: [] },
					compressor,
					{ maxCacheSize: 5 * MB },
					4,
				);
				await interceptor.startInterception();

				await fireResponses(
					interceptor,
					Array.from({ length: 5 }, (_, i) =>
						makeImageResponse(
							`https://cdn.example.com/s${session}-img${i}.jpg`,
							MB,
						),
					),
				);

				await interceptor.waitForCompressions();
				await interceptor.clearCache();

				// Estado deve estar completamente limpo
				expect(internal(interceptor).currentCacheSize).toBe(0);
				expect(internal(interceptor).inFlightBytes).toBe(0);
				expect(internal(interceptor).compressionQueue.size).toBe(0);
				expect(internal(interceptor)._cleared).toBe(true);
				expect(internal(interceptor).imageCache.size).toBe(0);
			}
		});

		it('currentCacheSize deve ser ≤ maxCacheSize após cada sessão (sem crescimento acumulado)', async () => {
			const compressor = makeFastCompressor();
			const MAX = 3 * MB;

			for (let session = 0; session < 20; session++) {
				const interceptor = new NetworkInterceptor(
					mockPage,
					{ blacklistTerms: [], whitelistTerms: [] },
					compressor,
					{ maxCacheSize: MAX },
					4,
				);
				await interceptor.startInterception();

				// Enviar mais do que cabe
				await fireResponses(
					interceptor,
					Array.from({ length: 10 }, (_, i) =>
						makeImageResponse(
							`https://cdn.example.com/s${session}-img${i}.jpg`,
							MB,
						),
					),
				);

				await interceptor.waitForCompressions();

				expect(
					internal(interceptor).currentCacheSize,
				).toBeLessThanOrEqual(MAX);

				await interceptor.clearCache();
			}
		});
	});

	// =========================================================================
	// [D] clearCache() cancela tarefas em voo via flag _cleared
	// =========================================================================
	describe('[D] clearCache() interrompe tarefas em voo', () => {
		it('deve ignorar resultados de compressão que chegam após clearCache()', async () => {
			const { compressor, release } = makeLatchCompressor();

			const interceptor = new NetworkInterceptor(
				mockPage,
				{ blacklistTerms: [], whitelistTerms: [] },
				compressor,
				{ maxCacheSize: 50 * MB },
				100,
			);
			await interceptor.startInterception();

			await fireResponses(
				interceptor,
				Array.from({ length: 5 }, (_, i) =>
					makeImageResponse(
						`https://cdn.example.com/img${i}.jpg`,
						MB,
					),
				),
			);
			expect(internal(interceptor).compressionQueue.size).toBe(5);

			// clearCache() e release() simultâneos:
			// mesmo que compress() resolva antes de clearCache() terminar,
			// o flag _cleared impede que resultados sejam adicionados ao cache
			const clearing = interceptor.clearCache();
			release();
			await clearing;

			expect(internal(interceptor).currentCacheSize).toBe(0);
			expect(internal(interceptor).inFlightBytes).toBe(0);
			expect(internal(interceptor).compressionQueue.size).toBe(0);
			expect(internal(interceptor).imageCache.size).toBe(0);
		});

		it('não deve popular o cache após _cleared = true', async () => {
			const { compressor, release } = makeLatchCompressor();

			const interceptor = new NetworkInterceptor(
				mockPage,
				{ blacklistTerms: [], whitelistTerms: [] },
				compressor,
				{ maxCacheSize: 50 * MB },
				100,
			);
			await interceptor.startInterception();

			await fireResponses(
				interceptor,
				Array.from({ length: 3 }, (_, i) =>
					makeImageResponse(
						`https://cdn.example.com/img${i}.jpg`,
						MB,
					),
				),
			);

			// Primeiro clearCache com latch ainda ativo
			const clearPromise = interceptor.clearCache();
			release();
			await clearPromise;

			// Nada deve ter entrado no cache
			expect(internal(interceptor).imageCache.size).toBe(0);
			expect(internal(interceptor).currentCacheSize).toBe(0);
		});
	});

	// =========================================================================
	// [E] Alta concorrência: flood de 10.000 respostas simultâneas
	// =========================================================================
	describe('[E] Alta concorrência: flood de 10.000 respostas simultâneas', () => {
		it('deve aceitar apenas maxCacheSize/imageSize imagens de um flood de 10.000', async () => {
			const MAX = 20 * MB;
			const IMG = MB;
			const TOTAL = 10_000;
			const EXPECTED = Math.floor(MAX / IMG); // 20

			const { compressor, release } = makeLatchCompressor();

			const interceptor = new NetworkInterceptor(
				mockPage,
				{ blacklistTerms: [], whitelistTerms: [] },
				compressor,
				{ maxCacheSize: MAX },
				10_000, // sem gargalo de slot para isolar só o back-pressure
			);
			await interceptor.startInterception();

			await fireResponses(
				interceptor,
				Array.from({ length: TOTAL }, (_, i) =>
					makeImageResponse(
						`https://cdn.example.com/img${i}.jpg`,
						IMG,
					),
				),
			);

			// Precisamente EXPECTED imagens foram admitidas (9.980 descartadas)
			expect(compressor.compress).toHaveBeenCalledTimes(EXPECTED);
			expect(internal(interceptor).compressionQueue.size).toBe(EXPECTED);

			release();
			await interceptor.waitForCompressions();

			expect(internal(interceptor).compressionQueue.size).toBe(0);
			expect(internal(interceptor).inFlightBytes).toBe(0);
			expect(internal(interceptor).currentCacheSize).toBeLessThanOrEqual(
				MAX,
			);

			await interceptor.clearCache();
		});

		it('deve manter compressionQueue.size em 0 após flood de 10.000 com compressor rápido', async () => {
			const compressor = makeFastCompressor();

			const interceptor = new NetworkInterceptor(
				mockPage,
				{ blacklistTerms: [], whitelistTerms: [] },
				compressor,
				{ maxCacheSize: 50 * MB },
				4, // concorrência realista
			);
			await interceptor.startInterception();

			await fireResponses(
				interceptor,
				Array.from({ length: 10_000 }, (_, i) =>
					makeImageResponse(
						`https://cdn.example.com/img${i}.jpg`,
						256 * 1024, // 256 KB cada
					),
				),
			);
			await interceptor.waitForCompressions();

			expect(internal(interceptor).compressionQueue.size).toBe(0);
			expect(internal(interceptor).inFlightBytes).toBe(0);
			expect(internal(interceptor).currentCacheSize).toBeLessThanOrEqual(
				50 * MB,
			);

			await interceptor.clearCache();
		});

		it('deve sobreviver a 1.000 sessões consecutivas sem acúmulo de estado', async () => {
			const compressor = makeFastCompressor();

			for (let session = 0; session < 1_000; session++) {
				const interceptor = new NetworkInterceptor(
					mockPage,
					{ blacklistTerms: [], whitelistTerms: [] },
					compressor,
					{ maxCacheSize: 3 * MB },
					4,
				);
				await interceptor.startInterception();

				// Cada sessão recebe 5 imagens de 1 MB (limite = 3 MB → 3 aceitas)
				await fireResponses(
					interceptor,
					Array.from({ length: 5 }, (_, i) =>
						makeImageResponse(
							`https://cdn.example.com/s${session}-img${i}.jpg`,
							MB,
						),
					),
				);
				await interceptor.waitForCompressions();
				await interceptor.clearCache();

				expect(internal(interceptor).currentCacheSize).toBe(0);
				expect(internal(interceptor).inFlightBytes).toBe(0);
				expect(internal(interceptor).compressionQueue.size).toBe(0);
				expect(internal(interceptor).imageCache.size).toBe(0);
			}
		});
	});

	// =========================================================================
	// [F] Upload de páginas pesadas: padrão real de capítulos de mangá/webtoon
	//
	// Um capítulo típico tem 20-300 páginas de 500 KB a 3 MB cada.
	// Múltiplos capítulos são scrapeados em paralelo por workers.
	// Este grupo verifica que a memória não cresce entre capítulos e que
	// o GC consegue recuperar memória (testado via process.memoryUsage).
	// =========================================================================
	describe('[F] Upload de páginas pesadas (padrão real de capítulos)', () => {
		/**
		 * Simula um capítulo completo: recebe N páginas pesadas, processa,
		 * e limpa. Retorna o heapUsed em bytes após o clearCache().
		 */
		async function runChapterSession(
			pageCount: number,
			pageSizeBytes: number,
			maxCacheMB: number,
		): Promise<number> {
			const compressor = makeFastCompressor();
			const interceptor = new NetworkInterceptor(
				{ on: jest.fn(), off: jest.fn() } as any,
				{ blacklistTerms: [], whitelistTerms: [] },
				compressor,
				{ maxCacheSize: maxCacheMB * MB },
				4,
			);
			await interceptor.startInterception();

			await fireResponses(
				interceptor,
				Array.from({ length: pageCount }, (_, i) =>
					makeImageResponse(
						`https://cdn.manga.com/chapter/page${i}.jpg`,
						pageSizeBytes,
					),
				),
			);
			await interceptor.waitForCompressions();
			await interceptor.clearCache();

			// Forçar GC se disponível (node --expose-gc)
			if (typeof global.gc === 'function') {
				global.gc();
			}

			return process.memoryUsage().heapUsed;
		}

		it('capítulo leve (50 páginas × 500 KB): heap não cresce entre sessões', async () => {
			// Aquecer – descarta a 1ª medição (JIT, módulos carregados)
			await runChapterSession(50, 512 * 1024, 30);

			const baseline = await runChapterSession(50, 512 * 1024, 30);
			const afterSecond = await runChapterSession(50, 512 * 1024, 30);
			const afterThird = await runChapterSession(50, 512 * 1024, 30);

			// Tolerância: até 50 MB de crescimento entre medições (JIT, closures do jest, etc.)
			const growthMB = (afterThird - baseline) / MB;
			expect(growthMB).toBeLessThan(50);
		}, 30_000);

		it('capítulo médio (100 páginas × 1 MB): heap não cresce entre sessões', async () => {
			await runChapterSession(100, MB, 60); // aquecimento

			const baseline = await runChapterSession(100, MB, 60);
			const afterSecond = await runChapterSession(100, MB, 60);
			const afterThird = await runChapterSession(100, MB, 60);

			const growthMB = (afterThird - baseline) / MB;
			expect(growthMB).toBeLessThan(60);
		}, 30_000);

		it('capítulo pesado (300 páginas × 2 MB): limite de cache bloqueia acúmulo — heap não estoura', async () => {
			// 300 × 2 MB = 600 MB bruto — o cache limita a 50 MB
			// Sem back-pressure isso causaria OOM; com a correção deve ser estável
			const MAX_CACHE_MB = 50;
			const compressor = makeFastCompressor();
			const interceptor = new NetworkInterceptor(
				{ on: jest.fn(), off: jest.fn() } as any,
				{ blacklistTerms: [], whitelistTerms: [] },
				compressor,
				{ maxCacheSize: MAX_CACHE_MB * MB },
				4,
			);
			await interceptor.startInterception();

			const heapBefore = process.memoryUsage().heapUsed;

			await fireResponses(
				interceptor,
				Array.from({ length: 300 }, (_, i) =>
					makeImageResponse(
						`https://cdn.manga.com/chapter/page${i}.jpg`,
						2 * MB,
					),
				),
			);
			await interceptor.waitForCompressions();

			const heapDuringMB =
				(process.memoryUsage().heapUsed - heapBefore) / MB;

			await interceptor.clearCache();
			if (typeof global.gc === 'function') global.gc();

			const heapAfterMB =
				(process.memoryUsage().heapUsed - heapBefore) / MB;

			// Durante: heap cresce no máximo maxCacheSize + folga para metadados
			expect(heapDuringMB).toBeLessThan(MAX_CACHE_MB + 60);
			// Depois do clearCache: a memória deve ter sido liberada
			expect(heapAfterMB).toBeLessThan(MAX_CACHE_MB);

			expect(internal(interceptor).currentCacheSize).toBe(0);
			expect(internal(interceptor).inFlightBytes).toBe(0);
		}, 60_000);

		it('10 capítulos sequenciais (150 páginas × 1 MB cada): heap estável ao longo de todos', async () => {
			const heaps: number[] = [];

			for (let chapter = 0; chapter < 10; chapter++) {
				const heap = await runChapterSession(150, MB, 80);
				heaps.push(heap);
			}

			// O heap não deve crescer indefinidamente entre capítulos.
			// Compara min e max: variação máxima de 80 MB é aceitável (JIT, caches do Node).
			const minHeap = Math.min(...heaps);
			const maxHeap = Math.max(...heaps);
			const driftMB = (maxHeap - minHeap) / MB;

			expect(driftMB).toBeLessThan(80);
		}, 120_000);

		it('capítulos concorrentes (5 workers × 80 páginas): nenhum worker extrapola o cache', async () => {
			// Simula 5 workers rodando ao mesmo tempo (como BullMQ com concurrencyLimit)
			const MAX_CACHE_MB = 40;

			const workerResults = await Promise.all(
				Array.from({ length: 5 }, (_, w) =>
					(async () => {
						const compressor = makeFastCompressor();
						const interceptor = new NetworkInterceptor(
							{ on: jest.fn(), off: jest.fn() } as any,
							{ blacklistTerms: [], whitelistTerms: [] },
							compressor,
							{ maxCacheSize: MAX_CACHE_MB * MB },
							4,
						);
						await interceptor.startInterception();

						await fireResponses(
							interceptor,
							Array.from({ length: 80 }, (_, i) =>
								makeImageResponse(
									`https://cdn.manga.com/w${w}/page${i}.jpg`,
									MB,
								),
							),
						);
						await interceptor.waitForCompressions();

						const cacheSize =
							internal(interceptor).currentCacheSize;
						const inFlight = internal(interceptor).inFlightBytes;
						const queueSize =
							internal(interceptor).compressionQueue.size;

						await interceptor.clearCache();
						return { cacheSize, inFlight, queueSize };
					})(),
				),
			);

			for (const result of workerResults) {
				expect(result.cacheSize).toBeLessThanOrEqual(MAX_CACHE_MB * MB);
				expect(result.inFlight).toBe(0);
				expect(result.queueSize).toBe(0);
			}
		}, 60_000);
	});
});
