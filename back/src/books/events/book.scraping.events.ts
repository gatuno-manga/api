import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chapter } from '../entitys/chapter.entity';
import { Page } from '../entitys/page.entity';
import { Book } from '../entitys/book.entity';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { ScrapingService } from 'src/scraping/scraping.service';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';
import { ChapterScrapingService } from '../jobs/chapter-scraping.service';

export class BookScrapingEvents {
	private logger = new Logger(BookScrapingEvents.name);

	constructor(
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		private readonly chapterScrapingService: ChapterScrapingService,

	) {}


	@OnEvent('book.created')
	async handleProcessChapters(book: Book) {
		const chapters = book.chapters
			.filter((chapter) => chapter.scrapingStatus === ScrapingStatus.PROCESS)
			.sort((a, b) => a.index - b.index);

		if (chapters.length === 0) {
			this.logger.warn(`Nenhum capítulo para processar no livro: ${book.title}`);
			return;
		}

		await Promise.all(chapters.map((chapter) => this.chapterScrapingService.addChapterToQueue(chapter.id)));
		this.logger.log(`Todos os capítulos do livro ${book.title} foram adicionados à fila de scraping.`);
	}

	@OnEvent('chapters.updated')
	async processChaptersList(chapters: Chapter[] | Chapter) {
		if (!Array.isArray(chapters)) chapters = [chapters];
		const chaptersToProcess = chapters
			.filter((chapter) => chapter.scrapingStatus === ScrapingStatus.PROCESS)
			.sort((a, b) => a.index - b.index);

		if (chaptersToProcess.length === 0) {
			this.logger.warn(`Nenhum capítulo para processar na lista recebida.`);
			return;
		}
		await Promise.all(chaptersToProcess.map((chapter) => this.chapterScrapingService.addChapterToQueue(chapter.id)));
		this.logger.log(`Total de capítulos a serem processados: ${chaptersToProcess.length}`);
	}
}
