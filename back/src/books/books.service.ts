import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Book } from './entitys/book.entity';
import { Repository } from 'typeorm';
import { Page } from './entitys/page.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Chapter } from './entitys/chapter.entity';
import { Tag } from './entitys/tags.entity';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { MetadataPageDto } from 'src/pages/metadata-page.dto';
import { PageDto } from 'src/pages/page.dto';
import { BookPageOptionsDto } from './dto/book-page-options.dto';

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

	async getAllBooks(options: BookPageOptionsDto): Promise<PageDto<any>> {
		const [books, total] = await this.bookRepository.findAndCount({
			relations: ['chapters'],
			skip: (options.page - 1) * options.limit,
			take: options.limit,
		});
		const data = books.map((book) => {
			const { chapters, ...rest } = book;
			return {
				...rest,
				chapterCount: chapters ? chapters.length : 0,
			};
		});
		const metadata = new MetadataPageDto();
		metadata.total = total;
		metadata.page = options.page;
		metadata.lastPage = Math.ceil(total / options.limit);

		return new PageDto(data, metadata);
	}

	async getOne(id: string): Promise<Book> {
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
