import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Book } from './entitys/book.entity';
import { Repository } from 'typeorm';
import { Page } from './entitys/page.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Chapter } from './entitys/chapter.entity';
import { Tag } from './entitys/tags.entity';

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
		@InjectRepository(Tag)
		private readonly tagRepository: Repository<Tag>,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async createBook(dto: CreateBookDto) {
		let tags: Tag[] = [];
		if (dto.tags && dto.tags.length > 0) {
			tags = await Promise.all(
				dto.tags.map(async (tagName: string) => {
					let tag = await this.tagRepository.findOne({
						where: { name: tagName },
					});
					if (!tag) {
						tag = this.tagRepository.create({ name: tagName });
						await this.tagRepository.save(tag);
					}
					return tag;
				}),
			);
		}

		const book = this.bookRepository.create({
			title: dto.title,
			originalUrl: dto.originalUrl,
			alternativeTitle: dto.alternativeTitle,
			coverUrl: dto.coverUrl,
			description: dto.description,
			publication: dto.publication,
			tags: tags,
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
}
