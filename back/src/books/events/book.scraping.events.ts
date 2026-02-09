import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookEvents } from '../constants/events.constant';
import { Book } from '../entities/book.entity';
import { Chapter } from '../entities/chapter.entity';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';
import { ChapterScrapingService } from '../jobs/chapter-scraping.service';
import { FixChapterService } from '../jobs/fix-chapter.service';

export class BookScrapingEvents {
	private logger = new Logger(BookScrapingEvents.name);

	constructor(
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		private readonly chapterScrapingService: ChapterScrapingService,
		private readonly fixChapterService: FixChapterService,
	) {}

	@OnEvent(BookEvents.CREATED)
	async handleProcessChapters(book: Book) {
		const chapters = book.chapters
			.filter(
				(chapter) => chapter.scrapingStatus === ScrapingStatus.PROCESS,
			)
			.sort((a, b) => a.index - b.index);

		if (chapters.length === 0) {
			this.logger.warn(
				`Nenhum capítulo para processar no livro: ${book.title}`,
			);
			return;
		}

		await Promise.all(
			chapters.map((chapter) =>
				this.chapterScrapingService.addChapterToQueue(chapter.id),
			),
		);
		this.logger.log(
			`Todos os capítulos do livro ${book.title} foram adicionados à fila de scraping.`,
		);
	}

	@OnEvent(BookEvents.CHAPTERS_UPDATED)
	async processChaptersList(input: Chapter[] | Chapter) {
		const chapters = Array.isArray(input) ? input : [input];
		const chaptersToProcess = chapters
			.filter(
				(chapter) => chapter.scrapingStatus === ScrapingStatus.PROCESS,
			)
			.sort((a, b) => a.index - b.index);

		if (chaptersToProcess.length === 0) {
			this.logger.warn(
				'Nenhum capítulo para processar na lista recebida.',
			);
			return;
		}
		await Promise.all(
			chaptersToProcess.map((chapter) =>
				this.chapterScrapingService.addChapterToQueue(chapter.id),
			),
		);
		this.logger.log(
			`Total de capítulos a serem processados: ${chaptersToProcess.length}`,
		);
	}

	@OnEvent(BookEvents.CHAPTERS_FIX)
	async handleFixBook(input: Chapter[] | Chapter) {
		const chapters = Array.isArray(input) ? input : [input];
		if (chapters.length === 0) {
			this.logger.warn(
				'Nenhum capítulo para consertar na lista recebida.',
			);
			return;
		}

		await Promise.all([
			this.chapterRepository.save(
				chapters.map((chapter) => {
					chapter.scrapingStatus = ScrapingStatus.PROCESS;
					return chapter;
				}),
			),
			...chapters.map((chapter) =>
				this.fixChapterService.addChapterToFixQueue(chapter.id),
			),
		]);
		this.logger.log(
			`Total de capítulos a serem consertados: ${chapters.length}`,
		);
	}
}
