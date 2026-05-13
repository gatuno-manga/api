import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { WebsiteService } from '@websites/application/services/website.service';
import { Repository } from 'typeorm';
import { Chapter } from '@books/infrastructure/database/entities/chapter.entity';
import { Page } from '@books/infrastructure/database/entities/page.entity';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';

/**
 * Serviço compartilhado para processamento de scraping de capítulos via microserviço.
 */
@Injectable()
export class ChapterScrapingSharedService {
	private readonly logger = new Logger(ChapterScrapingSharedService.name);

	constructor(
		@InjectRepository(Page)
		private readonly pageRepository: Repository<Page>,
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		@Inject('SCRAPER_SERVICE')
		private readonly scraperClient: ClientKafka,
		private readonly redisService: RedisService,
		private readonly websiteService: WebsiteService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Dispara a requisição de scraping para o microserviço Go.
	 * @param chapter O capítulo a ser processado
	 * @returns true se a requisição foi enviada
	 */
	async processChapterPages(chapter: Chapter): Promise<boolean> {
		const chapterInfo = `${chapter.book?.title || 'Unknown'} (${chapter.index})`;

		this.logger.debug(`Solicitando scraping para capítulo: ${chapterInfo}`);

		// Implementação de Distributed Lock via Redis
		const lockKey = `lock:scraping:chapter:${chapter.id}`;
		const redis = this.redisService.getClient();

		// Tenta adquirir o lock (3 minutos de TTL)
		const acquired = await redis.set(lockKey, '1', 'EX', 180, 'NX');

		if (!acquired) {
			this.logger.warn(
				`Chapter ${chapter.id} is already being scraped. Request ignored.`,
			);
			throw new ConflictException(
				`O capítulo ${chapter.id} já está sendo processado.`,
			);
		}

		try {
			const host = new URL(chapter.originalUrl).hostname;
			const websiteConfig = await this.websiteService.getByUrl(host);

			if (!websiteConfig) {
				this.logger.warn(`No website config found for host: ${host}`);
				this.emitFailedEvent(
					chapter,
					'Configuração do site não encontrada',
				);
				return false;
			}

			const payload = {
				jobId: crypto.randomUUID(),
				chapterId: chapter.id,
				bookId: chapter.book?.id,
				targetUrl: chapter.originalUrl,
				websiteConfig: {
					name: host,
					cloudflareBypass: websiteConfig.useFlareSolverr,
					selectors: {
						chapterTitle: websiteConfig.selector, // Em capítulos o 'selector' costuma ser o de imagens
						chapterImages: websiteConfig.selector,
					},
					headers: {
						Referer: host,
					},
				},
				uploadTarget: {
					bucket: 'processing',
					pathPrefix: `chapters/${chapter.book?.id}/${chapter.id}`,
				},
			};

			// Marca como processando e deleta páginas antigas se existirem
			await this.pageRepository.delete({ chapter: { id: chapter.id } });
			chapter.scrapingStatus = ScrapingStatus.PROCESS;
			await this.chapterRepository.save(chapter);

			// Emite o evento para o Kafka
			this.scraperClient.emit('scraping.chapter.requested', payload);

			// Emite evento local de início
			this.emitStartedEvent(chapter);

			this.logger.log(
				`Requisição enviada para o microserviço: ${chapterInfo}`,
			);
			return true;
		} catch (error) {
			this.logger.error(
				`Falha ao disparar scraping do capítulo ${chapter.id}: ${error.message}`,
			);

			// Libera o lock em caso de erro ANTES de enviar pro Kafka
			const lockKey = `lock:scraping:chapter:${chapter.id}`;
			await this.redisService.getClient().del(lockKey);

			chapter.scrapingStatus = ScrapingStatus.ERROR;
			await this.chapterRepository.save(chapter);

			this.emitFailedEvent(chapter, error.message);
			return false;
		}
	}

	/**
	 * Emite evento de início do scraping
	 */
	emitStartedEvent(chapter: Chapter): void {
		this.eventEmitter.emit('chapter.scraping.started', {
			chapterId: chapter.id,
			bookId: chapter.book?.id,
		});
	}

	/**
	 * Finaliza o processamento do capítulo com as páginas recebidas do microserviço
	 */
	async finalizeChapterScraping(
		chapter: Chapter,
		pagesPaths: string[],
	): Promise<void> {
		const startTime = Date.now();

		// Cria as novas páginas
		let index = 1;
		const newPages = pagesPaths.map((path) =>
			this.pageRepository.create({
				path: path,
				index: index++,
			}),
		);

		chapter.pages = newPages;
		chapter.scrapingStatus = ScrapingStatus.READY;
		await this.chapterRepository.save(chapter);

		// Emite eventos de sucesso
		this.eventEmitter.emit('chapter.scraping.completed', {
			chapterId: chapter.id,
			bookId: chapter.book?.id,
			pagesCount: pagesPaths.length,
		});

		// Emite evento de atualização de capítulo para o frontend
		this.eventEmitter.emit('chapters.updated', chapter);

		this.logger.log(
			`Capítulo ${chapter.id} finalizado com ${pagesPaths.length} páginas em ${(Date.now() - startTime) / 1000}s`,
		);
	}

	/**
	 * Emite evento de falha no scraping
	 */
	emitFailedEvent(chapter: Chapter, error: string): void {
		this.eventEmitter.emit('chapter.scraping.failed', {
			chapterId: chapter.id,
			bookId: chapter.book?.id,
			error,
		});

		// Emite evento de atualização de capítulo (status ERROR)
		this.eventEmitter.emit('chapters.updated', chapter);
	}
}
