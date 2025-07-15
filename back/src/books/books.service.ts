import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Book } from './entitys/book.entity';
import { Brackets, Repository } from 'typeorm';
import { Page } from './entitys/page.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Chapter } from './entitys/chapter.entity';
import { Tag } from './entitys/tags.entity';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { MetadataPageDto } from 'src/pages/metadata-page.dto';
import { PageDto } from 'src/pages/page.dto';
import { BookPageOptionsDto } from './dto/book-page-options.dto';
import { ScrapingService } from 'src/scraping/scraping.service';
import { UpdateBookDto } from './dto/update-book.dto';
import { ScrapingStatus } from './enum/scrapingStatus.enum';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { OrderChaptersDto } from './dto/order-chapters.dto';
import { CreateAuthorDto } from './dto/create-author.dto';
import { Author } from './entitys/author.entity';
import { AppConfigService } from 'src/app-config/app-config.service';
import { SensitiveContent } from './enum/sensitive-content.enum';
import { ChapterRead } from './entitys/chapter-read.entity';

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
		@InjectRepository(Author)
		private readonly authorRepository: Repository<Author>,
		private readonly scrapingService: ScrapingService,
		private readonly eventEmitter: EventEmitter2,
		private readonly appConfig: AppConfigService,
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

	private async findOrCreateAuthors(
		authorsDto: CreateAuthorDto[],
	): Promise<Author[]> {
		return Promise.all(
			authorsDto.map(async (authorDto) => {
				let author = await this.authorRepository.findOne({
					where: { name: authorDto.name },
				});
				if (!author) {
					author = this.authorRepository.create({
						name: authorDto.name,
						biography: authorDto.biography,
					});
					await this.authorRepository.save(author);
				}
				return author;
			}),
		);
	}

	private async createChaptersFromDtoTransactional(
		chaptersDto: CreateChapterDto[],
		book: Book,
		manager: Repository<Chapter>
	): Promise<Chapter[]> {
		const indices = chaptersDto.map(c => c.index);
		const uniqueIndices = new Set(indices);
		if (indices.length !== uniqueIndices.size && !indices.some(index => index === undefined || index === null)) {
			throw new BadRequestException('There are chapters with duplicate indices!');
		}
		const allHaveIndex = chaptersDto.every((chapterDto) => chapterDto.index !== undefined && chapterDto.index !== null);
		let count = 1;
		const chapters = chaptersDto.map((chapterDto) =>
			manager.create({
				title: chapterDto.title,
				originalUrl: chapterDto.url,
				index: allHaveIndex ? chapterDto.index : count++,
				book,
			}),
		);
		return manager.save(chapters);
	}

	async createBook(dto: CreateBookDto) {
		return await this.bookRepository.manager.transaction(async (manager) => {
			const tags =
				dto.tags && dto.tags.length > 0
					? await this.findOrCreateTags(dto.tags)
					: [];
			const authors = dto.authors && dto.authors.length > 0
				? await this.findOrCreateAuthors(dto.authors)
				: [];
			const book = manager.create(Book, {
				title: dto.title,
				originalUrl: dto.originalUrl,
				alternativeTitle: dto.alternativeTitle,
				description: dto.description,
				publication: dto.publication,
				type: dto.type,
				sensitiveContent: dto.sensitiveContent,
				tags,
				authors,
			});
			await manager.save(book);

			if (dto.chapters && dto.chapters.length > 0) {
				const chapterRepo = manager.getRepository(Chapter);
				const chapters = await this.createChaptersFromDtoTransactional(dto.chapters, book, chapterRepo);
				book.chapters = chapters;
			}

			if (dto.cover) {
				this.scrapingService
					.scrapeSingleImage(dto.cover.urlOrigin, dto.cover.urlImg)
					.then(async (cover) => {
						book.cover = cover;
						await this.bookRepository.save(book);
						this.logger.log(`Capa salva para o livro: ${book.title}`);
					})
					.catch((err) => {
						this.logger.warn(
							`Falha ao baixar capa para o livro: ${book.title}`,
							err,
						);
					});
			}

			const savedBook = await manager.save(book);
			this.eventEmitter.emit('book.created', savedBook);
			return savedBook;
		});
	}

	async getAllBooks(options: BookPageOptionsDto): Promise<PageDto<any>> {
		const queryBuilder = this.bookRepository
			.createQueryBuilder('book')
			.loadRelationCountAndMap('book.chapterCount', 'book.chapters')
			.skip((options.page - 1) * options.limit)
			.take(options.limit);

		let sensitiveContents: string[] = [];
		if (options.sensitiveContent) {
			if (Array.isArray(options.sensitiveContent)) {
				sensitiveContents = options.sensitiveContent;
			} else {
				sensitiveContents = [options.sensitiveContent];
			}
		}

		if (sensitiveContents.length === 0) {
			sensitiveContents = [SensitiveContent.SAFE];
		}

		const allSensitiveContents = Object.values(SensitiveContent);
		const notSelectContents = allSensitiveContents.filter(content =>
			!sensitiveContents.includes(content as SensitiveContent)
		);

		if (notSelectContents.length > 0) {
			const conditions = notSelectContents.map((content, index) =>
				`FIND_IN_SET(:ns${index}, book.sensitiveContent) = 0`
			).join(' AND ');

			const parameters = notSelectContents.reduce((params, content, index) => {
				params[`ns${index}`] = content;
				return params;
			}, {});

			queryBuilder.andWhere(`(${conditions})`, parameters);
		}

		let types: string[] = [];
		if (options.type) {
			if (Array.isArray(options.type)) {
				types = options.type;
			} else {
				types = [options.type];
			}
		}

		if (types.length) {
			queryBuilder.andWhere('book.type IN (:...types)', { types });
		}

		const [books, total] = await queryBuilder.getManyAndCount();

		const data = books.map((book) => {
			const { chapters, ...rest } = book;
			rest.cover = this.urlImage(book.cover);
			return {
				...rest,
				// chapterCount: chapters[chapters.length - 1]?.index || 0,
			};
		});
		const metadata = new MetadataPageDto();
		metadata.total = total;
		metadata.page = options.page;
		metadata.lastPage = Math.ceil(total / options.limit);

		return new PageDto(data, metadata);
	}

	private urlImage(url: string): string {
		const appUrl = this.appConfig.apiUrl;
		return `${appUrl}${url}`;
	}

	async getOne(id: string, userid?: string): Promise<Book> {
		const book = await this.bookRepository.findOne({
			where: { id },
			relations: ['chapters', 'tags', 'authors'],
			order: { chapters: { index: 'ASC' } },
			select: {
				id: true,
				title: true,
				alternativeTitle: true,
				originalUrl: true,
				description: true,
				publication: true,
				type: true,
				sensitiveContent: true,
				cover: true,
				tags: {
					name: true,
				},
				chapters: {
					id: true,
					title: true,
					scrapingStatus: true,
					index: true,
				},
				authors: {
					id: true,
					name: true,
				},
			},
		});
		if (!book) {
			this.logger.warn(`Book with id ${id} not found`);
			throw new NotFoundException(`Book with id ${id} not found`);
		}
		if (book.cover) {
			book.cover = this.urlImage(book.cover);
		}

		if (userid && book.chapters?.length) {
			const readChapters = await this.bookRepository.manager
				.getRepository(ChapterRead)
				.find({
					where: { user: { id: userid } },
					relations: ['chapter'],
					select: ['chapter'],
				});
			const readChapterIds = new Set(readChapters.map((cr) => cr.chapter.id));
			book.chapters = book.chapters.map((chapter: any) => ({
				...chapter,
				read: readChapterIds.has(chapter.id),
			}));
		}
		return book;
	}


	async updateBook(id: string, dto: UpdateBookDto) {
		const book = await this.bookRepository.findOne({
			where: { id },
			relations: ['tags'],
		});
		if (!book) {
			this.logger.warn(`Book with id ${id} not found`);
			throw new NotFoundException(`Book with id ${id} not found`);
		}

		this.bookRepository.merge(book, {
			title: dto.title,
			alternativeTitle: dto.alternativeTitle,
			originalUrl: dto.originalUrl,
			description: dto.description,
			publication: dto.publication,
			type: dto.type,
			sensitiveContent: dto.sensitiveContent,
		});

		if (dto.tags && dto.tags.length > 0) {
			book.tags = await this.findOrCreateTags(dto.tags);
		}

		if (dto.authors && dto.authors.length > 0) {
			book.authors = await this.findOrCreateAuthors(dto.authors);
		}

		if (dto.cover) {
			this.scrapingService
				.scrapeSingleImage(dto.cover.urlOrigin, dto.cover.urlImg)
				.then(async (cover) => {
					book.cover = cover;
					await this.bookRepository.save(book);
					this.logger.log(
						`Capa atualizada para o livro: ${book.title}`,
					);
				})
				.catch((err) => {
					this.logger.warn(
						`Falha ao baixar capa para o livro: ${book.title}`,
						err,
					);
				});
		}

		return this.bookRepository.save(book);
	}

	async updateChapter(idBook: string, dto: UpdateChapterDto[]) {
		const book = await this.bookRepository.findOne({
			where: { id: idBook },
			relations: ['chapters'],
			select: {
				id: true,
				chapters: {
					id: true,
					title: true,
					index: true,
					originalUrl: true,
					scrapingStatus: true,
					book: false,
				},
			},
		});
		if (!book) {
			this.logger.warn(`Book with id ${idBook} not found`);
			throw new NotFoundException(`Book with id ${idBook} not found`);
		}

		const indices = dto.map(c => c.index);
		const duplicates = indices.filter((item, idx) => indices.indexOf(item) !== idx);
		const uniqueDuplicates = [...new Set(duplicates)];
		if (uniqueDuplicates.length > 0) {
			throw new BadRequestException(
				`Há capítulos com índices duplicados: ${uniqueDuplicates.join(', ')}`
			);
		}
		const existingChapters = book.chapters.reduce(
			(acc, chapter) => ({ ...acc, [chapter.index]: chapter }),
			{},
		);

		const updatedChapters: Chapter[] = [];
		for (const chapterDto of dto) {
			const index = parseFloat(chapterDto.index.toString()).toFixed(1);
			let chapter = existingChapters[index];
			if (!chapter) {
				if (!chapterDto.url) {
					this.logger.warn(
						`Missing data for chapter with index ${chapterDto.index} in book ${idBook}`,
					);
					throw new NotFoundException(
						`Missing data for chapter with index ${chapterDto.index} in book ${idBook}`,
					);
				}
				chapter = this.chapterRepository.create({
					title: chapterDto.title,
					index: chapterDto.index,
					originalUrl: chapterDto.url,
					book: book,
				});
			} else {
				let scrapingStatus = chapter.scrapingStatus;
				if (chapterDto.url) {
					scrapingStatus = ScrapingStatus.PROCESS;
				}
				this.chapterRepository.merge(chapter, {
					title: chapterDto.title,
					index: chapterDto.index,
					originalUrl: chapterDto.url,
					scrapingStatus: scrapingStatus,
				});
			}
			updatedChapters.push(chapter);
		}
		book.chapters = [
			...updatedChapters,
			...book.chapters.filter(
				(chapter) =>
					!updatedChapters.some((c) => c.index === chapter.index),
			),
		];
		const savedBook = await this.bookRepository.save(book);
		this.eventEmitter.emit('chapters.updated', savedBook);
		return savedBook.chapters;
	}

	async orderChapters(idBook: string, chapters: OrderChaptersDto[]) {
		const book = await this.bookRepository.findOne({
			where: { id: idBook },
			relations: ['chapters'],
		});

		if (!book) {
			this.logger.warn(`Book with id ${idBook} not found`);
			throw new NotFoundException(`Book with id ${idBook} not found`);
		}

		if (chapters.length !== book.chapters.length) {
			this.logger.warn(
				`Number of chapters to order does not match the number of chapters in the book ${idBook}`,
			);
			throw new NotFoundException(
				`Number of chapters to order does not match the number of chapters in the book ${idBook}`,
			);
		}

		let tempIndex = -100_000;
		for (const chapter of book.chapters) {
			chapter.index = tempIndex++;
		}
		await this.chapterRepository.save(book.chapters);

		this.logger.log(
			`Reordered chapters for book ${idBook} to temporary indices`,
		);

		const chapterMap = new Map<string, Chapter>();
		book.chapters.forEach((chapter) => {
			chapterMap.set(chapter.id, chapter);
		});

		for (const chapterDto of chapters) {
			const chapter = chapterMap.get(chapterDto.id);
			if (!chapter) {
				this.logger.warn(
					`Chapter with id ${chapterDto.id} not found in book ${idBook}`,
				);
				throw new NotFoundException(
					`Chapter with id ${chapterDto.id} not found in book ${idBook}`,
				);
			}
			chapter.index = chapterDto.index;
		}

		const orderedChapters = await this.chapterRepository.save(
			Array.from(chapterMap.values()),
		);
		book.chapters = orderedChapters;
		return await this.bookRepository.save(book);
	}

	async fixBook(idBook: string) {
		const book = await this.bookRepository.findOne({
			where: { id: idBook },
			relations: ['chapters', 'chapters.pages'],
		});
		if (!book) {
			this.logger.warn(`Book with id ${idBook} not found`);
			throw new NotFoundException(`Book with id ${idBook} not found`);
		}
		const processChapter: Chapter[] = []
		for (const chapter of book.chapters) {
			if (
				chapter.scrapingStatus === ScrapingStatus.ERROR ||
				chapter.pages.length <= 5
			) {
				chapter.scrapingStatus = ScrapingStatus.PROCESS;
				processChapter.push(chapter);
			}
		}
		await this.bookRepository.save(
			this.bookRepository.merge(book, {
				chapters: processChapter,
			})
		);
		this.eventEmitter.emit('chapters.updated', book);
		return book;
	}
}
