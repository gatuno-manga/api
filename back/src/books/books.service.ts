import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

	private async findOrCreateTags(tagNames: string[]): Promise<Tag[]> {
		return Promise.all(
			tagNames.map(async (tagName) => {
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

	private createChaptersFromDto(
		chaptersDto: CreateChapterDto[],
		book: Book,
	): Chapter[] {
		let count = 1;
		return chaptersDto.map((chapterDto) =>
			this.chapterRepository.create({
				title: chapterDto.title,
				originalUrl: chapterDto.url,
				index: count++,
				book,
			}),
		);
	}

	async createBook(dto: CreateBookDto) {
		const tags =
			dto.tags && dto.tags.length > 0
				? await this.findOrCreateTags(dto.tags)
				: [];
		const book = this.bookRepository.create({
			title: dto.title,
			originalUrl: dto.originalUrl,
			alternativeTitle: dto.alternativeTitle,
			coverUrl: dto.coverUrl,
			description: dto.description,
			publication: dto.publication,
			tags,
		});

		if (dto.chapters && dto.chapters.length > 0) {
			book.chapters = this.createChaptersFromDto(dto.chapters, book);
		}

		const savedBook = await this.bookRepository.save(book);
		this.eventEmitter.emit('book.created', savedBook);
		return savedBook;
	}

	getAllBooks() {
		return this.bookRepository.find();
	}

	async getOne(id: string) {
		const book = await this.bookRepository.findOne({
			where: { id },
			relations: ['chapters'],
			order: { chapters: { index: 'ASC' } },
		});
		if (!book) {
			this.logger.warn(`Book with id ${id} not found`);
			throw new NotFoundException(`Book with id ${id} not found`);
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
