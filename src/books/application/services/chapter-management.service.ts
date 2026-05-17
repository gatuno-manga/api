import { CreateChapterBatchItemDto } from '@books/application/dto/create-chapter-batch-item.dto';
import { CreateChapterManualDto } from '@books/application/dto/create-chapter-manual.dto';
import { CreateChapterDto } from '@books/application/dto/create-chapter.dto';
import { OrderChaptersDto } from '@books/application/dto/order-chapters.dto';
import { UpdateChapterDto } from '@books/application/dto/update-chapter.dto';
import { IBookRepository } from '@books/application/ports/book-repository.interface';
import { IChapterRepository } from '@books/application/ports/chapter-repository.interface';
import { BookEvents } from '@books/domain/constants/events.constant';
import { Book } from '@books/domain/entities/book';
import { Chapter } from '@books/domain/entities/chapter';
import { ContentFormat } from '@books/domain/enums/content-format.enum';
import { ContentType } from '@books/domain/enums/content-type.enum';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { InjectQueue } from '@nestjs/bullmq';
import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';

@Injectable()
export class ChapterManagementService {
	private readonly logger = new Logger(ChapterManagementService.name);

	constructor(
		@Inject('IBookRepository')
		private readonly bookRepository: IBookRepository,
		@Inject('IChapterRepository')
		private readonly chapterRepository: IChapterRepository,
		private readonly eventEmitter: EventEmitter2,
		@InjectQueue('text-processing-queue')
		private readonly textProcessingQueue: Queue,
	) {}

	async createChapter(
		bookId: string,
		dto: CreateChapterDto,
	): Promise<Chapter> {
		const book = await this.bookRepository.findById(bookId);
		if (!book) {
			throw new NotFoundException(`Book with ID ${bookId} not found`);
		}

		// Determinar índice automaticamente se não fornecido
		let index = dto.index;
		if (index === undefined || index === null) {
			const chapters = await this.chapterRepository.findByBookId(bookId, {
				order: 'DESC',
				limit: 1,
			});
			const lastChapter = chapters.length > 0 ? chapters[0] : null;
			index = (lastChapter ? Number(lastChapter.index) : 0) + 1;
		}

		// Verificar se o índice já existe
		const existingChapter = await this.chapterRepository.findOne({
			book: { id: bookId } as Book,
			index: index,
		});

		if (existingChapter) {
			throw new BadRequestException(
				`Chapter with index ${index} already exists`,
			);
		}

		const chapter = this.chapterRepository.create({
			title: dto.title,
			originalUrl: dto.url,
			index,
			isFinal: dto.isFinal,
			book: { id: bookId } as Book,
		});

		const savedChapter = await this.chapterRepository.save(chapter);

		this.eventEmitter.emit(BookEvents.CHAPTER_CREATED, savedChapter);

		return savedChapter;
	}

	async createManualChapter(
		bookId: string,
		dto: CreateChapterManualDto,
	): Promise<Chapter> {
		return this.createChapterManual(bookId, dto);
	}

	async createManualChapterWithContent(
		bookId: string,
		dto: CreateChapterManualDto,
	): Promise<Chapter> {
		return this.createChapterManual(bookId, dto);
	}

	async createChapterManual(
		bookId: string,
		dto: CreateChapterManualDto,
	): Promise<Chapter> {
		const book = await this.bookRepository.findById(bookId);
		if (!book) {
			throw new NotFoundException(`Book with ID ${bookId} not found`);
		}

		const chapter = this.chapterRepository.create({
			title: dto.title,
			index: dto.index,
			content: dto.content,
			contentFormat: dto.format || ContentFormat.MARKDOWN,
			contentType: ContentType.TEXT,
			book: { id: bookId } as Book,
			scrapingStatus: ScrapingStatus.READY,
		});

		const savedChapter = await this.chapterRepository.save(chapter);

		// Enfileira para processamento de texto (ex: extrair imagens se houver)
		if (savedChapter.content) {
			await this.textProcessingQueue.add('process-text', {
				entityId: savedChapter.id,
				bookId,
				source: 'CHAPTER',
				format: savedChapter.contentFormat || ContentFormat.MARKDOWN,
			});
		}

		this.eventEmitter.emit(BookEvents.CHAPTER_CREATED, savedChapter);

		return savedChapter;
	}

	async updateChapter(id: string, dto: UpdateChapterDto): Promise<Chapter> {
		const chapter = await this.chapterRepository.findById(id, ['book']);
		if (!chapter) {
			throw new NotFoundException(`Chapter with ID ${id} not found`);
		}

		const updatedChapter = this.chapterRepository.merge(chapter, {
			title: dto.title,
			originalUrl: dto.url,
			index: dto.index,
			content: dto.content,
			contentFormat: dto.format,
		});
		const savedChapter = await this.chapterRepository.save(updatedChapter);

		// Se o conteúdo mudou, reprocessa
		if (dto.content || dto.url) {
			await this.textProcessingQueue.add('process-text', {
				entityId: savedChapter.id,
				bookId: savedChapter.book?.id,
				source: 'CHAPTER',
				format:
					savedChapter.contentFormat ||
					dto.format ||
					ContentFormat.MARKDOWN,
			});
		}

		this.eventEmitter.emit(BookEvents.CHAPTERS_UPDATED, savedChapter);

		return savedChapter;
	}

	async updateChapters(
		bookId: string,
		dtos: UpdateChapterDto[],
	): Promise<Chapter[]> {
		const results: Chapter[] = [];
		for (const dto of dtos) {
			if (dto.index) {
				const chapter = await this.chapterRepository.findOne({
					book: { id: bookId } as Book,
					index: dto.index,
				});
				if (chapter) {
					results.push(await this.updateChapter(chapter.id, dto));
				}
			}
		}
		return results;
	}

	async deleteChapter(id: string): Promise<void> {
		const chapter = await this.chapterRepository.findById(id, [
			'book',
			'pages',
		]);
		if (!chapter) {
			throw new NotFoundException(`Chapter with ID ${id} not found`);
		}

		const pages = chapter.pages?.map((p) => p.path) || [];
		const bookId = chapter.book?.id;

		await this.chapterRepository.delete(id);

		this.eventEmitter.emit(BookEvents.CHAPTER_DELETED, {
			chapterId: id,
			bookId,
			pages,
		});
	}

	async createChaptersBatch(
		bookId: string,
		chaptersDto: CreateChapterBatchItemDto[],
	): Promise<Chapter[]> {
		const book = await this.bookRepository.findById(bookId);
		if (!book) {
			throw new NotFoundException(`Book with ID ${bookId} not found`);
		}

		const chapters = chaptersDto.map((dto) =>
			this.chapterRepository.create({
				title: dto.title,
				index: dto.index,
				originalUrl: dto.url,
				book: { id: bookId } as Book,
			}),
		);

		const savedChapters = await this.chapterRepository.saveAll(chapters);

		this.eventEmitter.emit(BookEvents.CHAPTERS_UPDATED, savedChapters);

		return savedChapters;
	}

	async createManualChaptersInBatch(
		dtos: CreateChapterBatchItemDto[],
	): Promise<Chapter[]> {
		const results: Chapter[] = [];
		for (const dto of dtos) {
			results.push(
				await this.createManualChapter(dto.bookId, {
					title: dto.title,
					index: dto.index,
					content: dto.content,
					format: dto.format,
				}),
			);
		}
		return results;
	}

	async reorderChapters(
		_bookId: string,
		chapterIds: string[],
	): Promise<Chapter[]> {
		const chapters = await this.chapterRepository.findByIds(chapterIds);

		if (chapters.length !== chapterIds.length) {
			throw new BadRequestException('Some chapters were not found');
		}

		const updatedChapters = chapters.map((chapter) => {
			const newIndex = chapterIds.indexOf(chapter.id) + 1;
			chapter.index = newIndex;
			return chapter;
		});

		const savedChapters =
			await this.chapterRepository.saveAll(updatedChapters);

		this.eventEmitter.emit(BookEvents.CHAPTERS_UPDATED, savedChapters);

		return savedChapters;
	}

	async orderChapters(
		bookId: string,
		dtos: OrderChaptersDto[],
	): Promise<Chapter[]> {
		const chapterIds = dtos
			.sort((a, b) => a.index - b.index)
			.map((d) => d.id);
		return this.reorderChapters(bookId, chapterIds);
	}

	async fixBookChapters(bookId: string): Promise<Book> {
		return this.fixChaptersIndices(bookId);
	}

	async resetBookChapters(bookId: string): Promise<Book> {
		const book = await this.bookRepository.findById(bookId, ['chapters']);
		if (!book) {
			throw new NotFoundException(`Book with ID ${bookId} not found`);
		}

		for (const chapter of book.chapters) {
			await this.chapterRepository.delete(chapter.id);
		}

		return {
			...book,
			chapters: [],
		} as Book;
	}

	async fixChaptersIndices(bookId: string): Promise<Book> {
		const book = await this.bookRepository.findById(bookId, ['chapters']);
		if (!book) {
			throw new NotFoundException(`Book with ID ${bookId} not found`);
		}

		const sortedChapters = [...book.chapters].sort(
			(a, b) => a.index - b.index,
		);

		const updatedChapters = sortedChapters.map((chapter, idx) => {
			chapter.index = idx + 1;
			return chapter;
		});

		await this.chapterRepository.saveAll(updatedChapters);

		this.eventEmitter.emit(BookEvents.CHAPTERS_FIX, updatedChapters);

		return {
			...book,
			chapters: updatedChapters.map((ch) => {
				const { book: _, ...chapterWithoutBook } = ch;
				return chapterWithoutBook as Chapter;
			}),
		} as Book;
	}

	async swapChaptersIndices(
		_idBook: string,
		idChapterA: string,
		idChapterB: string,
	): Promise<Chapter[]> {
		const [chapterA, chapterB] = await Promise.all([
			this.chapterRepository.findById(idChapterA),
			this.chapterRepository.findById(idChapterB),
		]);

		if (!chapterA || !chapterB) {
			throw new NotFoundException('One or both chapters not found');
		}

		const indexA = chapterA.index;
		const indexB = chapterB.index;

		chapterA.index = indexB;
		chapterB.index = indexA;

		const saved = await this.chapterRepository.saveAll([
			chapterA,
			chapterB,
		]);

		this.eventEmitter.emit(BookEvents.CHAPTERS_UPDATED, saved);

		return saved;
	}

	async setChaptersIndex(
		_idBook: string,
		idChapters: string[],
		indices: number[],
	): Promise<Chapter[]> {
		if (idChapters.length !== indices.length) {
			throw new BadRequestException(
				'Arrays of IDs and indices must have the same length',
			);
		}

		const chapters = await this.chapterRepository.findByIds(idChapters);

		if (chapters.length !== idChapters.length) {
			throw new BadRequestException('Some chapters were not found');
		}

		const updatedChapters = chapters.map((chapter) => {
			const idIdx = idChapters.indexOf(chapter.id);
			chapter.index = indices[idIdx];
			return chapter;
		});

		const saved = await this.chapterRepository.saveAll(updatedChapters);

		this.eventEmitter.emit(BookEvents.CHAPTERS_UPDATED, saved);

		return saved;
	}

	async shiftChaptersIndices(
		idBook: string,
		startIndex: number,
		shift: number,
	): Promise<void> {
		const chapters = await this.chapterRepository.findByBookId(idBook);

		const toUpdate = chapters.filter((ch) => ch.index >= startIndex);

		const updated = toUpdate.map((ch) => {
			ch.index += shift;
			return ch;
		});

		await this.chapterRepository.saveAll(updated);

		this.eventEmitter.emit(BookEvents.CHAPTERS_UPDATED, updated);
	}

	async createChaptersFromDto(
		bookId: string,
		chaptersDto: CreateChapterDto[],
	): Promise<Chapter[]> {
		const results: Chapter[] = [];
		for (const dto of chaptersDto) {
			results.push(await this.createChapter(bookId, dto));
		}
		return results;
	}
}
