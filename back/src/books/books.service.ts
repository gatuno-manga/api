import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import { ScrapingService } from 'src/scraping/scraping.service';
import { CoverImageService } from './jobs/cover-image.service';
import { UpdateBookDto } from './dto/update-book.dto';
import { ScrapingStatus } from './enum/scrapingStatus.enum';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { OrderChaptersDto } from './dto/order-chapters.dto';
import { CreateAuthorDto } from './dto/create-author.dto';
import { Author } from './entitys/author.entity';
import { AppConfigService } from 'src/app-config/app-config.service';
import { SensitiveContent } from './entitys/sensitive-content.entity';
import { ChapterRead } from './entitys/chapter-read.entity';
import { SensitiveContentService } from './sensitive-content/sensitive-content.service';

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
		@InjectRepository(SensitiveContent)
		private readonly sensitiveContentRepository: Repository<SensitiveContent>,
		private readonly sensitiveContentService: SensitiveContentService,
		private readonly coverImageService: CoverImageService,
		private readonly eventEmitter: EventEmitter2,
		private readonly appConfig: AppConfigService,
	) {}

	private async findOrCreateTags(tagNames: string[]): Promise<Tag[]> {
		return Promise.all(
			tagNames.map(async (tagName) => {
				const lowerTagName = tagName.toLowerCase();
				let tag = await this.tagRepository
					.createQueryBuilder('tag')
					.where('tag.name = :tagName', { tagName: lowerTagName })
					.orWhere('JSON_CONTAINS(tag.altNames, :jsonTagName)', {
						jsonTagName: `"${lowerTagName}"`,
					})
					.getOne()
				if (!tag) {
					tag = this.tagRepository.create({ name: lowerTagName });
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
		const filteredIndices = indices.filter(index => index !== undefined && index !== null);
		const uniqueFilteredIndices = new Set(filteredIndices);
		const duplicates = filteredIndices.filter((item, idx) => filteredIndices.indexOf(item) !== idx);
		const uniqueDuplicates = [...new Set(duplicates)];
		if (filteredIndices.length !== uniqueFilteredIndices.size) {
			throw new BadRequestException(`Há capítulos com índices duplicados: ${uniqueDuplicates.join(', ')}`);
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

	async findOrCreateSensitiveContent(
		sensitiveContentNames: string[],
	): Promise<SensitiveContent[]> {
		return Promise.all(
			sensitiveContentNames.map(async (name) => {
				const lowerName = name.toLowerCase();
				let sensitiveContent = await this.sensitiveContentRepository
					.createQueryBuilder('sensitiveContent')
					.where('sensitiveContent.name = :name', { name: lowerName })
					.orWhere('JSON_CONTAINS(sensitiveContent.altNames, :jsonName)', {
						jsonName: `"${lowerName}"`,
					})
					.getOne();
				if (!sensitiveContent) {
					sensitiveContent = this.sensitiveContentRepository.create({ name: lowerName });
					await this.sensitiveContentRepository.save(sensitiveContent);
				}
				return sensitiveContent;
			}),
		);
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
			const sensitiveContent = dto.sensitiveContent && dto.sensitiveContent.length > 0
				? await this.findOrCreateSensitiveContent(dto.sensitiveContent)
				: [];
			const book = manager.create(Book, {
				title: dto.title,
				originalUrl: dto.originalUrl,
				alternativeTitle: dto.alternativeTitle,
				description: dto.description,
				publication: dto.publication,
				type: dto.type,
				sensitiveContent,
				tags,
				authors,
				chapters: [],
			});
			await manager.save(book);

			if (dto.chapters && dto.chapters.length > 0) {
				const chapterRepo = manager.getRepository(Chapter);
				const chapters = await this.createChaptersFromDtoTransactional(dto.chapters, book, chapterRepo);
				book.chapters = chapters;
			}

			if (dto.cover) {
				await this.coverImageService.addCoverToQueue(book.id, dto.cover.urlOrigin, dto.cover.urlImg);
			}
			const savedBook = await manager.save(book);
			this.eventEmitter.emit('book.created', savedBook);
			return savedBook;
		});
	}

	async getAllBooks(options: BookPageOptionsDto, maxWeightSensitiveContent: number = 0): Promise<PageDto<any>> {
		const queryBuilder = this.bookRepository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.sensitiveContent', 'sensitiveContent')
			.loadRelationCountAndMap('book.chapterCount', 'book.chapters')
			.orderBy('book.createdAt', 'DESC')
			.skip((options.page - 1) * options.limit)
			.take(options.limit);


		await this.sensitiveContentService.filterBooksSensitiveContent(queryBuilder, options.sensitiveContent, maxWeightSensitiveContent);
		if (options.type && options.type.length > 0) {
			queryBuilder.andWhere('book.type IN (:...types)', { types: options.type });
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

	async getOne(id: string, userid?: string, maxWeightSensitiveContent: number = 0): Promise<Book> {
		const book = await this.bookRepository.findOne({
			where: { id },
			relations: ['chapters', 'tags', 'authors', 'sensitiveContent'],
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
					id: true,
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
		const maxWeight = book.sensitiveContent.reduce((sum, sc) => sum + (sc.weight || 0), 0);
		if (maxWeight > maxWeightSensitiveContent) {
			this.logger.warn(`Book with id ${id} exceeds max weight`);
			throw new ForbiddenException(`Book with id ${id} exceeds max weight`);
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
			relations: ['tags', 'sensitiveContent'],
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
		});

		if (dto.tags && dto.tags.length > 0) {
			book.tags = await this.findOrCreateTags(dto.tags);
		}

		if (dto.authors && dto.authors.length > 0) {
			book.authors = await this.findOrCreateAuthors(dto.authors);
		}

		if (dto.sensitiveContent && dto.sensitiveContent.length > 0) {
			book.sensitiveContent = await this.findOrCreateSensitiveContent(dto.sensitiveContent);
		}

		if (dto.cover) {
			await this.coverImageService.addCoverToQueue(book.id, dto.cover.urlOrigin, dto.cover.urlImg);
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
		this.eventEmitter.emit('chapters.updated', savedBook.chapters);
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
			const hasNullPathPage = chapter.pages.some(page => page.path === null || page.path.startsWith('null') || page.path.startsWith('undefined'));
			if (
				chapter.scrapingStatus === ScrapingStatus.ERROR ||
				chapter.pages.length <= 5 ||
				hasNullPathPage
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
		this.eventEmitter.emit('chapters.updated', book.chapters);
		return book;
	}

	async resetBook(idBook: string) {
		const book = await this.bookRepository.findOne({
			where: { id: idBook },
			relations: ['chapters'],
		});
		if (!book) {
			this.logger.warn(`Book with id ${idBook} not found`);
			throw new NotFoundException(`Book with id ${idBook} not found`);
		}
		for (const chapter of book.chapters) {
			chapter.scrapingStatus = ScrapingStatus.PROCESS;
		}
		await this.bookRepository.save(book);
		this.eventEmitter.emit('chapters.updated', book.chapters);
		return book;
	}

	async verifyBook(idBook: string) {
		const book = await this.bookRepository.findOne({
			where: { id: idBook },
			relations: ['chapters', 'chapters.pages'],
		});
		if (!book) {
			this.logger.warn(`Book with id ${idBook} not found`);
			throw new NotFoundException(`Book with id ${idBook} not found`);
		}
		const errorChapters: Chapter[] = [];
		for (const chapter of book.chapters) {
			const hasNullPathPage = chapter.pages.some(page => page.path === null || page.path.startsWith('null') || page.path.startsWith('undefined'));
			// this.logger.log(`Verifying chapter ${chapter.id} with ${hasNullPathPage} pages`);
			if (
				chapter.scrapingStatus === ScrapingStatus.ERROR ||
				chapter.pages.length <= 5 ||
				hasNullPathPage
			) {
				chapter.scrapingStatus = ScrapingStatus.ERROR;
				errorChapters.push(chapter);
			}
		}
		return {
			numberOfChapters: book.chapters.length,
			numberOfPages: book.chapters.reduce((acc, chapter) => acc + chapter.pages.length, 0),
			numberOfChaptersWithError: errorChapters.length,
			pagesErrorCount: errorChapters.reduce((acc, chapter) => acc + chapter.pages.filter(page => page.path === null || page.path.startsWith('null') || page.path.startsWith('undefined')).length, 0),
			errorChapters: errorChapters.map(chapter => ({
				id: chapter.id,
				title: chapter.title,
				scrapingStatus: chapter.scrapingStatus,
				erroPages: chapter.pages.filter(page => page.path === null || page.path.startsWith('null') || page.path.startsWith('undefined')).length,
			})),
		};
	}

	async getDashboardOverview() {
		const [books, chapters, pages] = await Promise.all([
			this.bookRepository.count(),
			this.chapterRepository.count(),
			this.pageRepository.count(),
		]);
		const sensitiveContentCount = await this.sensitiveContentRepository.count();
		const tagsCount = await this.tagRepository.count();
		const authorsCount = await this.authorRepository.count();

		return {
			books,
			chapters,
			pages,
			sensitiveContent: sensitiveContentCount,
			tags: tagsCount,
			authors: authorsCount,
		};
	}

	async getProcessBook() {
		const books = await this.bookRepository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.chapters', 'chapter')
			.select(['book.id', 'book.cover', 'book.title', 'chapter.id', 'chapter.title', 'chapter.scrapingStatus'])
			.getMany();

		let totalChapters = 0;
		let processingChapters = 0;

		const booksWithProcessing = books
			.map(book => {
				const chapters = (book.chapters || []).filter(ch => ch.scrapingStatus === ScrapingStatus.PROCESS);
				if (chapters.length === 0) return null;
				totalChapters += chapters.length;
				processingChapters += chapters.length;
				return {
					id: book.id,
					title: book.title,
					cover: this.urlImage(book.cover),
					processingChapters: chapters.length,
					totalChapters: book.chapters.length,
				};
			})
			.filter(Boolean);

		return {
			totalChapters,
			processingChapters,
			books: booksWithProcessing
		};
	}
}
