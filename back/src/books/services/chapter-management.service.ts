import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { normalizeUrl } from 'src/common/utils/url.utils';
import { DataSource, In, Repository } from 'typeorm';
import { BookEvents } from '../constants/events.constant';
import { ChapterUpdatedEvent } from '../chapters/events/chapter-updated.event';
import { CreateChapterBatchItemDto } from '../dto/create-chapter-batch-item.dto';
import { CreateChapterManualDto } from '../dto/create-chapter-manual.dto';
import { CreateChapterDto } from '../dto/create-chapter.dto';
import { OrderChaptersDto } from '../dto/order-chapters.dto';
import { UpdateChapterDto } from '../dto/update-chapter.dto';
import { Book } from '../entities/book.entity';
import { Chapter } from '../entities/chapter.entity';
import { ContentFormat } from '../enum/content-format.enum';
import { ContentType } from '../enum/content-type.enum';
import { ExportFormat } from '../enum/export-format.enum';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';
/**
 * Service responsável por gerenciar capítulos de livros
 */
@Injectable()
export class ChapterManagementService {
	private readonly logger = new Logger(ChapterManagementService.name);

	constructor(
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		private readonly eventEmitter: EventEmitter2,
		private readonly dataSource: DataSource,
	) {}

	private validateManualChapterTextFields(dto: CreateChapterManualDto) {
		const hasContent = dto.content !== undefined && dto.content !== null;
		const hasFormat = dto.format !== undefined && dto.format !== null;

		if (hasContent !== hasFormat) {
			throw new BadRequestException(
				"Campos 'content' e 'format' devem ser enviados juntos",
			);
		}
	}

	private mapContentFormatToExportFormat(
		format: ContentFormat,
	): ExportFormat {
		switch (format) {
			case ContentFormat.MARKDOWN:
				return ExportFormat.MARKDOWN;
			case ContentFormat.HTML:
			case ContentFormat.PLAIN:
				return ExportFormat.PDF;
			default:
				return ExportFormat.PDF;
		}
	}

	/**
	 * Cria um capítulo manual (sem URL para scraping)
	 */
	async createManualChapter(
		bookId: string,
		dto: CreateChapterManualDto,
	): Promise<Chapter> {
		this.validateManualChapterTextFields(dto);
		this.logger.log(`Creating manual chapter for book: ${bookId}`);

		const book = await this.bookRepository.findOne({
			where: { id: bookId },
		});

		if (!book) {
			this.logger.warn(`Book with id ${bookId} not found`);
			throw new NotFoundException(`Book with id ${bookId} not found`);
		}

		// Determinar índice automaticamente se não fornecido
		let index = dto.index;
		if (index === undefined || index === null) {
			const lastChapter = await this.chapterRepository.findOne({
				where: { book: { id: bookId } },
				order: { index: 'DESC' },
			});
			index = (lastChapter ? Number(lastChapter.index) : 0) + 1;
		}

		// Verificar se o índice já existe
		const existingChapter = await this.chapterRepository.findOne({
			where: {
				book: { id: bookId },
				index: index,
			},
		});

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

		this.eventEmitter.emit(BookEvents.CHAPTER_CREATED, savedChapter);
		this.eventEmitter.emit(
			BookEvents.CHAPTER_UPDATED,
			new ChapterUpdatedEvent(savedChapter.id, bookId),
		);

		return savedChapter;
	}

	/**
	 * Cria capítulo manual e, opcionalmente, já salva conteúdo textual
	 */
	async createManualChapterWithContent(
		bookId: string,
		dto: CreateChapterManualDto,
	): Promise<Chapter> {
		this.validateManualChapterTextFields(dto);
		const content = dto.content;
		const format = dto.format;
		if (!content || !format) {
			return this.createManualChapter(bookId, dto);
		}

		const savedChapter = await this.dataSource.transaction(
			async (manager) => {
				const transactionBookRepo = manager.getRepository(Book);
				const transactionChapterRepo = manager.getRepository(Chapter);

				const book = await transactionBookRepo.findOne({
					where: { id: bookId },
				});

				if (!book) {
					this.logger.warn(`Book with id ${bookId} not found`);
					throw new NotFoundException(
						`Book with id ${bookId} not found`,
					);
				}

				let index = dto.index;
				if (index === undefined || index === null) {
					const lastChapter = await transactionChapterRepo.findOne({
						where: { book: { id: bookId } },
						order: { index: 'DESC' },
					});
					index = (lastChapter ? Number(lastChapter.index) : 0) + 1;
				}

				const existingChapter = await transactionChapterRepo.findOne({
					where: {
						book: { id: bookId },
						index: index,
					},
				});

				if (existingChapter) {
					throw new BadRequestException(
						`Chapter with index ${index} already exists`,
					);
				}

				const chapter = transactionChapterRepo.create({
					title: dto.title || `Chapter ${index}`,
					originalUrl: '',
					index,
					book,
					scrapingStatus: null,
					contentType: ContentType.TEXT,
					content,
					contentFormat: format,
					documentPath: null,
					documentFormat: null,
				});

				const createdChapter =
					await transactionChapterRepo.save(chapter);

				const exportFormat =
					this.mapContentFormatToExportFormat(format);
				const currentFormats = book.availableFormats || [];
				if (!currentFormats.includes(exportFormat)) {
					book.availableFormats = [...currentFormats, exportFormat];
					await transactionBookRepo.save(book);
				}

				return createdChapter;
			},
		);

		this.logger.log(
			`Manual chapter with text created: ${savedChapter.title} (${savedChapter.id})`,
		);

		this.eventEmitter.emit(BookEvents.CHAPTER_CREATED, savedChapter);
		this.eventEmitter.emit(
			BookEvents.CHAPTER_UPDATED,
			new ChapterUpdatedEvent(savedChapter.id, bookId),
		);
		this.eventEmitter.emit('chapter.content.uploaded', {
			chapterId: savedChapter.id,
			bookId,
			format,
		});

		return savedChapter;
	}

	/**
	 * Cria capítulos manuais em lote com resultado por item
	 */
	async createManualChaptersInBatch(
		items: CreateChapterBatchItemDto[],
	): Promise<{
		total: number;
		success: number;
		failed: number;
		results: Array<{
			position: number;
			bookId: string;
			chapterId?: string;
			status: 'success' | 'error';
			message?: string;
		}>;
	}> {
		const results: Array<{
			position: number;
			bookId: string;
			chapterId?: string;
			status: 'success' | 'error';
			message?: string;
		}> = [];

		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			try {
				const chapter = await this.createManualChapterWithContent(
					item.bookId,
					{
						title: item.title,
						index: item.index,
						content: item.content,
						format: item.format,
					},
				);

				results.push({
					position: i,
					bookId: item.bookId,
					chapterId: chapter.id,
					status: 'success',
				});
			} catch (error) {
				const message =
					error instanceof Error
						? error.message
						: 'Erro desconhecido';
				results.push({
					position: i,
					bookId: item.bookId,
					status: 'error',
					message,
				});
			}
		}

		const success = results.filter((r) => r.status === 'success').length;
		return {
			total: items.length,
			success,
			failed: items.length - success,
			results,
		};
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
				originalUrl: chapterDto.url ? normalizeUrl(chapterDto.url) : '',
				index: allHaveIndex ? chapterDto.index : count++,
				book,
				scrapingStatus: chapterDto.url
					? ScrapingStatus.PROCESS
					: ScrapingStatus.READY,
			}),
		);

		return manager.save(chapters);
	}

	private determineDecimalPlaces(
		dto: UpdateChapterDto[],
		existingChapters: Chapter[],
	): number {
		for (const c of dto) {
			if (c.index !== undefined && c.index !== null) {
				const s = c.index.toString();
				if (s.includes('.')) {
					return s.split('.')[1].length;
				}
			}
		}

		let maxPlaces = 0;
		for (const chapter of existingChapters) {
			if (chapter.index?.toString().includes('.')) {
				const places = chapter.index.toString().split('.')[1].length;
				if (places > maxPlaces) maxPlaces = places;
			}
		}

		return maxPlaces > 0 ? maxPlaces : 3;
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
			select: { id: true, title: true, availableFormats: true },
		});

		if (!book) {
			this.logger.warn(`Book with id ${idBook} not found`);
			throw new NotFoundException(`Book with id ${idBook} not found`);
		}

		// Validar duplicatas no DTO
		const indices = dto.map((c) => c.index);
		const uniqueIndices = new Set(indices);
		if (indices.length !== uniqueIndices.size) {
			const duplicates = indices.filter(
				(item, idx) => indices.indexOf(item) !== idx,
			);
			throw new BadRequestException(
				`Há capítulos com índices duplicados: ${[...new Set(duplicates)].join(', ')}`,
			);
		}

		// Buscar capítulos existentes que correspondem aos índices do DTO
		const existingChapters = await this.chapterRepository.find({
			where: {
				book: { id: idBook },
				index: In(indices),
			},
		});

		const decimalPlaces = this.determineDecimalPlaces(
			dto,
			existingChapters,
		);
		const chapterMap = new Map<string, Chapter>();
		for (const ch of existingChapters) {
			chapterMap.set(Number(ch.index).toFixed(decimalPlaces), ch);
		}

		const updatedChapters: Chapter[] = [];
		for (const chapterDto of dto) {
			const indexStr = Number.parseFloat(
				chapterDto.index.toString(),
			).toFixed(decimalPlaces);
			let chapter = chapterMap.get(indexStr);

			if (!chapter) {
				if (!chapterDto.url) {
					throw new NotFoundException(
						`Chapter with index ${chapterDto.index} not found and no URL provided to create it`,
					);
				}
				chapter = this.chapterRepository.create({
					title: chapterDto.title,
					index: chapterDto.index,
					originalUrl: chapterDto.url,
					book: book,
				});
			} else {
				const scrapingStatus = chapterDto.url
					? ScrapingStatus.PROCESS
					: chapter.scrapingStatus;

				this.chapterRepository.merge(chapter, {
					title: chapterDto.title,
					index: chapterDto.index,
					originalUrl: chapterDto.url,
					scrapingStatus,
				});
			}
			updatedChapters.push(chapter);
		}

		const savedChapters =
			await this.chapterRepository.save(updatedChapters);

		// Emitir eventos
		this.eventEmitter.emit(BookEvents.CHAPTERS_UPDATED, savedChapters);
		for (const chapter of savedChapters) {
			this.eventEmitter.emit(
				BookEvents.CHAPTER_UPDATED,
				new ChapterUpdatedEvent(chapter.id, idBook),
			);
		}

		return savedChapters;
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

		const chapterMap = new Map<string, Chapter>();
		for (const chapter of book.chapters) {
			chapterMap.set(chapter.id, chapter);
		}
		for (const chapterDto of chapters) {
			if (!chapterMap.has(chapterDto.id)) {
				this.logger.warn(
					`Chapter with id ${chapterDto.id} not found in book ${idBook}`,
				);
				throw new NotFoundException(
					`Chapter with id ${chapterDto.id} not found in book ${idBook}`,
				);
			}
		}

		const { savedBook, orderedChapters } =
			await this.dataSource.transaction(async (manager) => {
				const transactionChapterRepo = manager.getRepository(Chapter);
				const transactionBookRepo = manager.getRepository(Book);

				// Usar índices temporários negativos para evitar conflitos de UNIQUE constraint durante o processo
				let tempIndex = -100_000;
				for (const chapter of book.chapters) {
					chapter.index = tempIndex++;
				}
				await transactionChapterRepo.save(book.chapters);

				// Aplicar os novos índices finais
				for (const chapterDto of chapters) {
					const chapter = chapterMap.get(chapterDto.id);
					if (chapter) chapter.index = chapterDto.index;
				}

				const resultChapters = await transactionChapterRepo.save(
					Array.from(chapterMap.values()),
				);
				book.chapters = resultChapters;

				const resultBook = await transactionBookRepo.save(book);

				return {
					savedBook: resultBook,
					orderedChapters: resultChapters,
				};
			});

		this.logger.log(`Reordered chapters for book ${idBook}`);

		for (const ch of savedBook.chapters) {
			ch.book = savedBook;
		}
		for (const chapter of orderedChapters) {
			this.eventEmitter.emit(
				BookEvents.CHAPTER_UPDATED,
				new ChapterUpdatedEvent(chapter.id, idBook),
			);
		}
		this.eventEmitter.emit(BookEvents.CHAPTERS_UPDATED, savedBook.chapters);

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

		// Garantir que o livro esteja anexado para o evento sem causar erro de referência circular no JSON
		for (const ch of book.chapters) {
			ch.book = book;
		}
		this.eventEmitter.emit(BookEvents.CHAPTERS_UPDATED, book.chapters);

		// Remover referências circulares de forma limpa antes de retornar
		return {
			...book,
			chapters: book.chapters.map((ch) => {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const { book: _, ...chapterWithoutBook } = ch;
				return chapterWithoutBook as Chapter;
			}),
		} as Book;
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

		for (const ch of book.chapters) {
			ch.book = book;
		}
		this.eventEmitter.emit(BookEvents.CHAPTERS_FIX, book.chapters);

		return {
			...book,
			chapters: book.chapters.map((ch) => {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const { book: _, ...chapterWithoutBook } = ch;
				return chapterWithoutBook as Chapter;
			}),
		} as Book;
	}
}
