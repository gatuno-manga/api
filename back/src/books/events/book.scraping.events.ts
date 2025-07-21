import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chapter } from '../entitys/chapter.entity';
import { Page } from '../entitys/page.entity';
import { Book } from '../entitys/book.entity';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { ScrapingService } from 'src/scraping/scraping.service';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';

export class BookScrapingEvents {
	private logger = new Logger(BookScrapingEvents.name);
	private hostnameCount: Map<string, number> = new Map();
	private concurrency = 8;

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
		const chapters = book.chapters
			.filter((chapter) => chapter.scrapingStatus === ScrapingStatus.PROCESS)
			.sort((a, b) => a.index - b.index);

		if (chapters.length === 0) {
			this.logger.warn(`Nenhum capítulo para processar no livro: ${book.title}`);
			return;
		}
		this.logger.log(`Iniciando o scraping para o livro: ${book.title}`);
		this.logger.log(`Total de capítulos a serem processados: ${chapters.length}`);

		await Promise.all(chapters.map((chapter) => this.processWithLimit(chapter)));

		book.scrapingStatus = ScrapingStatus.READY;
		await this.bookRepository.save(book);
		this.logger.log(`Scraping concluído para o livro: ${book.title}`);
		this.eventEmitter.emit('book.scraped', book);
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

		this.logger.log(`Iniciando o scraping para lista de capítulos.`);
		this.logger.log(`Total de capítulos a serem processados: ${chaptersToProcess.length}`);

		await Promise.all(chaptersToProcess.map((chapter) => this.processWithLimit(chapter)));
		this.logger.log(`Scraping concluído para a lista de capítulos.`);
	}

	private async processWithLimit(chapter: Chapter) {
		const hostname = new URL(chapter.originalUrl).hostname;
		while ((this.hostnameCount.get(hostname) || 0) >= this.concurrency) {
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
		this.hostnameCount.set(hostname, (this.hostnameCount.get(hostname) || 0) + 1);
		try {
			await this.processChapter(chapter);
		} catch (err) {
			this.logger.error(`Erro ao processar capítulo ${chapter.index}:`, err);
		} finally {
			this.hostnameCount.set(hostname, this.hostnameCount.get(hostname)! - 1);
		}
	}

	private async processChapter(chapter: Chapter) {
		await this.pageRepository.delete({ chapter: { id: chapter.id } });
		chapter.pages = [];
		this.logger.log(`Iniciando o scraping para o capítulo: ${chapter.index}`);

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
