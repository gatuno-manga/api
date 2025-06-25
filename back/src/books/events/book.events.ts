import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chapter } from '../entitys/chapter.entity';
import { Page } from '../entitys/page.entity';
import { Book } from '../entitys/book.entity';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { ScrapingService } from 'src/scraping/scraping.service';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';

export class BookEvents {
	private logger = new Logger(BookEvents.name);
	constructor(
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		@InjectRepository(Page)
		private readonly pageRepository: Repository<Page>,
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		private readonly scrapingService: ScrapingService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	@OnEvent('book.created')
	async handleProcessChapters(book: Book) {
		this.logger.log(`Iniciando o scraping para o livro: ${book.title}`);
		this.logger.log(`Total de capítulos: ${book.chapters.length}`);
		const chapters = [
			...book.chapters.filter(
				(chapter) => chapter.scrapingStatus === ScrapingStatus.PROCESS,
			),
		];
		this.logger.log(
			`Total de capítulos a serem processados: ${chapters.length}`,
		);
		const concurrency = 4;
		while (chapters.length > 0) {
			const batch = chapters.splice(0, concurrency);
			await Promise.all(
				batch.map((chapter) => this.processChapter(chapter)),
			);
		}
		book.scrapingStatus = ScrapingStatus.READY;
		await this.bookRepository.save(book);
		this.logger.log(`Scraping concluído para o livro: ${book.title}`);
		this.eventEmitter.emit('book.scraped', book);
	}

	private async processChapter(chapter: Chapter) {
		const pages = await this.scrapingService.scrapePages(
			chapter.originalUrl,
		);
		if (!pages) {
			chapter.scrapingStatus = ScrapingStatus.ERROR;
			await this.chapterRepository.save(chapter);
			this.logger.warn(
				`Nenhuma página encontrada para o capítulo: ${chapter.index}`,
			);
			return;
		}
		let index = 1;
		chapter.pages = pages.map((pageContent) => {
			const page = this.pageRepository.create({
				path: pageContent,
				index: index++,
			});
			return page;
		});
		chapter.scrapingStatus = ScrapingStatus.READY;
		await this.chapterRepository.save(chapter);
		this.logger.log(`Páginas salvas para o capítulo: ${chapter.index}`);
	}
}
