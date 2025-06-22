import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ScrapingService } from 'src/scraping/scraping.service';
import { Book } from './entitys/book.entity';
import { Repository } from 'typeorm';
import { Page } from './entitys/page.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Chapter } from './entitys/chapter.entity';

@Injectable()
export class BooksService {
	logger = new Logger(BooksService.name);
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

	async createBook(dto: CreateBookDto) {
		const book = this.bookRepository.create({
			title: dto.title,
		});
		await this.bookRepository.save(book);
		book.chapters = [];
		if (dto.chapters && dto.chapters.length > 0) {
			let count = 1;
			book.chapters = dto.chapters.map((chapterDto) => {
				const chapter = this.chapterRepository.create({
					title: chapterDto.title,
					originalUrl: chapterDto.url,
					index: count++,
				});
				return chapter;
			});
		}
		const saveBook = await this.bookRepository.save(book);
		this.eventEmitter.emit('book.created', saveBook);
		return saveBook;
	}

	getAllBooks() {
		return this.bookRepository.find();
	}

	async getOne(id: string) {
		const book = await this.bookRepository.findOne({
			where: { id },
			relations: ['chapters'],
		});
		if (book && book.chapters) {
			book.chapters = book.chapters.sort((a, b) => a.index - b.index);
		}
		return book;
	}

	async getChapter(idBook: string, idChapter: string) {
		return this.chapterRepository.findOne({
			where: { id: idChapter, book: { id: idBook } },
			relations: ['pages'],
		});
	}

	@OnEvent('book.created')
	async handleBookCreatedEvent(book: Book) {
		this.logger.log(`Iniciando o scraping para o livro: ${book.title}`);
		for (const chapter of book.chapters) {
			const pages = await this.scrapingService.scrapePages(
				chapter.originalUrl,
			);
			if (!pages) {
				this.logger.warn(
					`Nenhuma página encontrada para o capítulo: ${chapter.title}`,
				);
				continue;
			}
			let index = 1;
			chapter.pages = pages.map((pageContent) => {
				const page = this.pageRepository.create({
					path: pageContent,
					index: index++,
				});
				return page;
			});
			// await this.chapterRepository.save(chapter);
			this.logger.log(
				`Páginas salvas para o capítulo: ${chapter.title} do livro: ${book.title}`,
			);
		}
		book.scrapingStatus = 'ready';
		await this.bookRepository.save(book);
		this.logger.log(`Scraping concluído para o livro: ${book.title}`);
		this.eventEmitter.emit('book.scraped', book);
	}
}
