import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chapter } from '../entitys/chapter.entity';
import { Book } from '../entitys/book.entity';
import { CreateChapterDto } from '../dto/create-chapter.dto';
import { CreateChapterManualDto } from '../dto/create-chapter-manual.dto';
import { UpdateChapterDto } from '../dto/update-chapter.dto';
import { OrderChaptersDto } from '../dto/order-chapters.dto';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { normalizeUrl } from 'src/common/utils/url.utils';
import { ChapterUpdatedEvent } from '../chapters/events/chapter-updated.event';

/**
 * Service responsável por gerenciar capítulos de livros
	*/;
@Injectable()
export class ChapterManagementService {
	private readonly logger = new Logger(ChapterManagementService.name);

	constructor(
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Cria um capítulo manual (sem URL para scraping)
	 */
	async createManualChapter(
		bookId: string,
		dto: CreateChapterManualDto,
	): Promise<Chapter> {
		this.logger.log(`Creating manual chapter for book: ${bookId}`);

		const book = await this.bookRepository.findOne({
			where: { id: bookId },
			relations: ['chapters'],
		});

		if (!book) {
			this.logger.warn(`Book with id ${bookId} not found`);
			throw new NotFoundException(`Book with id ${bookId} not found`);
		}

		// Determinar índice automaticamente se não fornecido
		let index = dto.index;
		if (index === undefined || index === null) {
			const maxIndex =
				book.chapters.length > 0
					? Math.max(...book.chapters.map((c) => Number(c.index)))
					: 0;
			index = maxIndex + 1;
		}

		// Verificar se o índice já existe
		const existingChapter = book.chapters.find(
			(c) => Number(c.index) === index,
		);
		if (existingChapter) {
			throw new BadRequestException(
				`Chapter with index ${index} already exists`,
			);
		}

		const chapter = this.chapterRepository.create({
			title: dto.title || `Chapter ${index}`,
			originalUrl: '', // Capítulo manual não tem URL
			index,
			book,
			scrapingStatus: ScrapingStatus.READY, // Pronto para receber páginas
		});

		const savedChapter = await this.chapterRepository.save(chapter);

		this.logger.log(
			`Manual chapter created: ${savedChapter.title} (${savedChapter.id})`,
		);

		this.eventEmitter.emit('chapter.created', savedChapter);
		this.eventEmitter.emit(
			'chapter.updated',
			new ChapterUpdatedEvent(savedChapter.id, bookId),
		);

		return savedChapter;
	}

	/**
	 * Cria capítulos a partir de DTOs em uma transação
	 */
	async createChaptersFromDto(
		chaptersDto: CreateChapterDto[],
		book: Book,
		manager: Repository<Chapter>,
	): Promise<Chapter[]> {
		const indices = chaptersDto.map((c) => c.index);
		const filteredIndices = indices.filter(
			(index) => index !== undefined && index !== null,
		);
		const uniqueFilteredIndices = new Set(filteredIndices);
		const duplicates = filteredIndices.filter(
			(item, idx) => filteredIndices.indexOf(item) !== idx,
		);
		const uniqueDuplicates = [...new Set(duplicates)];

		if (filteredIndices.length !== uniqueFilteredIndices.size) {
			throw new BadRequestException(
				`Há capítulos com índices duplicados: ${uniqueDuplicates.join(', ')}`,
			);
		}

		const allHaveIndex = chaptersDto.every(
			(chapterDto) =>
				chapterDto.index !== undefined && chapterDto.index !== null,
		);
		let count = 1;
		const chapters = chaptersDto.map((chapterDto) =>
			manager.create({
				title: chapterDto.title,
				originalUrl: chapterDto.url ? normalizeUrl(chapterDto.url) : '', // URL opcional agora
				index: allHaveIndex ? chapterDto.index : count++,
				book,
			}),
		);

		return manager.save(chapters);
	}

	/**
	 * Atualiza capítulos de um livro
	 */
	async updateChapters(
		idBook: string,
		dto: UpdateChapterDto[],
	): Promise<Chapter[]> {
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

		const indices = dto.map((c) => c.index);
		const duplicates = indices.filter(
			(item, idx) => indices.indexOf(item) !== idx,
		);
		const uniqueDuplicates = [...new Set(duplicates)];

		if (uniqueDuplicates.length > 0) {
			throw new BadRequestException(
				`Há capítulos com índices duplicados: ${uniqueDuplicates.join(', ')}`,
			);
		}

		const existingChapters = book.chapters.reduce(
			(acc, chapter) => ({ ...acc, [chapter.index]: chapter }),
			{},
		);

		const determineDecimalPlaces = (): number => {
			for (const c of dto) {
				if (c.index !== undefined && c.index !== null) {
					const s = c.index.toString();
					if (s.includes('.')) {
						return s.split('.')[1].length;
					}
				}
			}

			let maxPlaces = 0;
			for (const ch of Object.keys(existingChapters)) {
				if (ch && ch.toString().includes('.')) {
					const places = ch.toString().split('.')[1].length;
					if (places > maxPlaces) maxPlaces = places;
				}
			}
			if (maxPlaces > 0) return maxPlaces;

			return 3;
		};

		const decimalPlaces = determineDecimalPlaces();

		const updatedChapters: Chapter[] = [];
		for (const chapterDto of dto) {
			const index = parseFloat(chapterDto.index.toString()).toFixed(
				decimalPlaces,
			);
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

		savedBook.chapters.forEach((ch) => (ch.book = savedBook));
		this.eventEmitter.emit('chapters.updated', savedBook.chapters);
		for (const chapter of updatedChapters) {
			this.eventEmitter.emit(
				'chapter.updated',
				new ChapterUpdatedEvent(chapter.id, idBook),
			);
		}

		return savedBook.chapters;
	}

	/**
	 * Reordena capítulos de um livro
	 */
	async orderChapters(
		idBook: string,
		chapters: OrderChaptersDto[],
	): Promise<Book> {
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

		// Define índices temporários para evitar conflitos
		let tempIndex = -100_000;
		for (const chapter of book.chapters) {
			chapter.index = tempIndex++;
		}
		await this.chapterRepository.save(book.chapters);

		this.logger.log(
			`Reordered chapters for book ${idBook} to temporary indices`,
		);

		// Mapeia capítulos por ID
		const chapterMap = new Map<string, Chapter>();
		book.chapters.forEach((chapter) => {
			chapterMap.set(chapter.id, chapter);
		});

		// Aplica a nova ordem
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

		const savedBook = await this.bookRepository.save(book);

		// Emit event for reordering
		savedBook.chapters.forEach((ch) => (ch.book = savedBook));
		for (const chapter of orderedChapters) {
			this.eventEmitter.emit(
				'chapter.updated',
				new ChapterUpdatedEvent(chapter.id, idBook),
			);
		}
		this.eventEmitter.emit('chapters.updated', savedBook.chapters);

		return savedBook;
	}

	/**
	 * Reseta o status de scraping de todos os capítulos
	 */
	async resetBookChapters(idBook: string): Promise<Book> {
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

		// Ensure book is attached for event
		this.logger.debug(
			'Emitting chapters.updated event for resetBookChapters',
		);
		book.chapters.forEach((ch) => (ch.book = book));
		this.eventEmitter.emit('chapters.updated', book.chapters);

		// Remove circular references before returning
		book.chapters.forEach((ch) => delete (ch as any).book);

		return book;
	}

	/**
	 * Emite evento para consertar capítulos
	 */
	async fixBookChapters(idBook: string): Promise<Book> {
		const book = await this.bookRepository.findOne({
			where: { id: idBook },
			relations: ['chapters', 'chapters.pages'],
		});

		if (!book) {
			this.logger.warn(`Book with id ${idBook} not found`);
			throw new NotFoundException(`Book with id ${idBook} not found`);
		}

		// Ensure book is attached for event
		book.chapters.forEach((ch) => (ch.book = book));
		this.eventEmitter.emit('chapters.fix', book.chapters);

		// Remove circular references before returning
		book.chapters.forEach((ch) => delete (ch as any).book);

		return book;
	}
}
