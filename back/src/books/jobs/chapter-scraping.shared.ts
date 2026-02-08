import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { ScrapingService } from 'src/scraping/scraping.service';
import { Repository } from 'typeorm';
import { Chapter } from '../entitys/chapter.entity';
import { Page } from '../entitys/page.entity';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';

/**
 * Serviço compartilhado para processamento de scraping de capítulos.
 * Elimina duplicação de código entre ChapterScrapingJob e FixChapterProcessor.
 */
@Injectable()
export class ChapterScrapingSharedService {
	private readonly logger = new Logger(ChapterScrapingSharedService.name);

	constructor(
		@InjectRepository(Page)
		private readonly pageRepository: Repository<Page>,
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		private readonly scrapingService: ScrapingService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Processa o scraping de páginas de um capítulo.
	 * @param chapter O capítulo a ser processado
	 * @param minPages Número mínimo de páginas esperadas (opcional, usado para fix)
	 * @returns true se o processamento foi bem-sucedido
	 */
	async processChapterPages(
		chapter: Chapter,
		minPages?: number,
	): Promise<boolean> {
		const startTime = Date.now();
		const chapterInfo = `${chapter.book?.title || 'Unknown'} (${chapter.index})`;

		this.logger.debug(`Iniciando scraping para capítulo: ${chapterInfo}`);

		try {
			// Delete páginas existentes
			await this.pageRepository.delete({ chapter: { id: chapter.id } });

			// Faz o scraping
			const pages = await this.scrapingService.scrapePages(
				chapter.originalUrl,
				minPages,
			);

			if (!pages || pages.length === 0) {
				chapter.scrapingStatus = ScrapingStatus.ERROR;
				await this.chapterRepository.save(chapter);
				this.logger.warn(
					`Nenhuma página encontrada para o capítulo: ${chapterInfo}`,
				);

				this.emitFailedEvent(chapter, 'Nenhuma página encontrada');
				return false;
			}

			// Cria as novas páginas
			let index = 1;
			const newPages = pages.map((pageContent) =>
				this.pageRepository.create({
					path: pageContent,
					index: index++,
				}),
			);

			chapter.pages = newPages;
			chapter.scrapingStatus = ScrapingStatus.READY;
			await this.chapterRepository.save(chapter);

			// Emite eventos de sucesso
			this.emitCompletedEvent(chapter, pages.length);

			const endTime = Date.now();
			this.logger.log(
				`Páginas salvas para o capítulo: ${chapterInfo} em ${(endTime - startTime) / 1000}s`,
			);

			return true;
		} catch (error) {
			this.logger.error(
				`Falha no scraping do capítulo ${chapter.id}: ${error.message}`,
				error.stack,
			);

			chapter.scrapingStatus = ScrapingStatus.ERROR;
			await this.chapterRepository.save(chapter);

			this.emitFailedEvent(chapter, error.message);

			throw error;
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
	 * Emite evento de scraping completado
	 */
	private emitCompletedEvent(chapter: Chapter, pagesCount: number): void {
		this.eventEmitter.emit('chapter.scraping.completed', {
			chapterId: chapter.id,
			bookId: chapter.book?.id,
			pagesCount,
		});

		// Emite evento de atualização de capítulo
		this.eventEmitter.emit('chapters.updated', chapter);
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
