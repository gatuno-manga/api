import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Book } from '../entities/book.entity';
import { Chapter } from '../entities/chapter.entity';
import { Cover } from '../entities/cover.entity';
import { Page } from '../entities/page.entity';

export interface DeletionResult {
	deletedBooks?: number;
	deletedChapters?: number;
	deletedPages?: number;
	deletedCovers?: number;
	filesScheduledForDeletion: number;
	success: boolean;
	errors?: string[];
}

@Injectable()
export class BookDeletionService {
	private readonly logger = new Logger(BookDeletionService.name);

	constructor(
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		@InjectRepository(Cover)
		private readonly coverRepository: Repository<Cover>,
		@InjectRepository(Page)
		private readonly pageRepository: Repository<Page>,
		private readonly eventEmitter: EventEmitter2,
		private readonly dataSource: DataSource,
	) {}

	async deleteBook(bookId: string): Promise<DeletionResult> {
		this.logger.log(`Deleting book: ${bookId}`);

		const book = await this.bookRepository.findOne({
			where: { id: bookId },
			select: { id: true, title: true },
		});

		if (!book) {
			throw new NotFoundException(`Book with id ${bookId} not found`);
		}

		const [coverPaths, pagePaths] = await Promise.all([
			this.coverRepository
				.createQueryBuilder('cv')
				.innerJoin('cv.book', 'bk')
				.where('bk.id = :bookId', { bookId })
				.select(['cv.url'])
				.getMany(),
			this.pageRepository
				.createQueryBuilder('p')
				.innerJoin('p.chapter', 'ch')
				.where('ch.bookId = :bookId', { bookId })
				.select(['p.path'])
				.getMany(),
		]);

		const coverFiles = coverPaths.map((c) => c.url).filter(Boolean);
		const pageFiles = pagePaths.map((p) => p.path).filter(Boolean);
		const totalFiles = coverFiles.length + pageFiles.length;

		const [deletedChaptersCount, deletedCoversCount] = await Promise.all([
			this.chapterRepository.count({ where: { book: { id: bookId } } }),
			this.coverRepository.count({ where: { book: { id: bookId } } }),
		]);

		try {
			await this.pageRepository
				.createQueryBuilder('p')
				.softDelete()
				.where(
					'chapterId IN (SELECT id FROM chapters WHERE bookId = :bookId)',
					{ bookId },
				)
				.execute();

			await this.chapterRepository
				.createQueryBuilder('ch')
				.softDelete()
				.where('ch.bookId = :bookId', { bookId })
				.execute();

			await this.coverRepository
				.createQueryBuilder('cv')
				.softDelete()
				.where('cv.bookId = :bookId', { bookId })
				.execute();

			await this.bookRepository.softDelete({ id: bookId });

			this.eventEmitter.emit('book.deleted', {
				bookId: book.id,
				bookTitle: book.title,
				covers: coverFiles,
				pages: pageFiles,
			});

			this.logger.log(`Book deleted successfully: ${book.title}`);

			return {
				deletedBooks: 1,
				deletedChapters: deletedChaptersCount,
				deletedPages: pageFiles.length,
				deletedCovers: deletedCoversCount,
				filesScheduledForDeletion: totalFiles,
				success: true,
			};
		} catch (error) {
			this.logger.error(`Error deleting book ${bookId}:`, error);
			return {
				filesScheduledForDeletion: 0,
				success: false,
				errors: [(error as Error).message],
			};
		}
	}

	async deleteBooks(bookIds: string[]): Promise<DeletionResult> {
		this.logger.log(`Deleting ${bookIds.length} books in batch`);

		if (bookIds.length === 0) {
			throw new BadRequestException('No book IDs provided');
		}

		if (bookIds.length > 100) {
			throw new BadRequestException(
				'Maximum 100 books per batch deletion',
			);
		}

		const books = await this.bookRepository.find({
			where: { id: In(bookIds) },
			select: { id: true, title: true },
		});

		if (books.length === 0) {
			throw new NotFoundException('No books found with provided IDs');
		}

		const foundBookIds = books.map((b) => b.id);

		const [coverRows, pageRows] = await Promise.all([
			this.coverRepository
				.createQueryBuilder('cv')
				.innerJoin('cv.book', 'bk')
				.where('bk.id IN (:...foundBookIds)', { foundBookIds })
				.select('bk.id', 'bookId')
				.addSelect('cv.url', 'url')
				.getRawMany<{ bookId: string; url: string }>(),
			this.pageRepository
				.createQueryBuilder('p')
				.innerJoin('p.chapter', 'ch')
				.innerJoin('ch.book', 'bk')
				.where('bk.id IN (:...foundBookIds)', { foundBookIds })
				.select('bk.id', 'bookId')
				.addSelect('p.path', 'path')
				.getRawMany<{ bookId: string; path: string }>(),
		]);

		const coversByBook = new Map<string, string[]>();
		const pagesByBook = new Map<string, string[]>();
		for (const row of coverRows) {
			if (!coversByBook.has(row.bookId)) coversByBook.set(row.bookId, []);
			if (row.url) coversByBook.get(row.bookId)?.push(row.url);
		}
		for (const row of pageRows) {
			if (!pagesByBook.has(row.bookId)) pagesByBook.set(row.bookId, []);
			if (row.path) pagesByBook.get(row.bookId)?.push(row.path);
		}

		const totalFiles =
			coverRows.filter((r) => r.url).length +
			pageRows.filter((r) => r.path).length;

		const [totalChapters, totalCovers] = await Promise.all([
			this.chapterRepository.count({
				where: { book: { id: In(foundBookIds) } },
			}),
			coverRows.length,
		]);

		const queryRunner = this.dataSource.createQueryRunner('master');
		try {
			await queryRunner.connect();
			await queryRunner.startTransaction();

			await queryRunner.manager
				.createQueryBuilder(Page, 'p')
				.softDelete()
				.where(
					'chapterId IN (SELECT id FROM chapters WHERE bookId IN (:...foundBookIds))',
					{ foundBookIds },
				)
				.execute();

			await queryRunner.manager
				.createQueryBuilder(Chapter, 'ch')
				.softDelete()
				.where('ch.bookId IN (:...foundBookIds)', { foundBookIds })
				.execute();

			await queryRunner.manager
				.createQueryBuilder(Cover, 'cv')
				.softDelete()
				.where('cv.bookId IN (:...foundBookIds)', { foundBookIds })
				.execute();

			await queryRunner.manager
				.createQueryBuilder(Book, 'b')
				.softDelete()
				.whereInIds(foundBookIds)
				.execute();

			await queryRunner.commitTransaction();
		} catch (error) {
			await queryRunner.rollbackTransaction();
			this.logger.error(
				'Error in batch book deletion, rolled back:',
				error,
			);
			return {
				filesScheduledForDeletion: 0,
				success: false,
				errors: [(error as Error).message],
			};
		} finally {
			await queryRunner.release();
		}

		for (const book of books) {
			this.eventEmitter.emit('book.deleted', {
				bookId: book.id,
				bookTitle: book.title,
				covers: coversByBook.get(book.id) ?? [],
				pages: pagesByBook.get(book.id) ?? [],
			});
		}

		this.logger.log(`Batch deletion completed: ${books.length} books`);

		return {
			deletedBooks: books.length,
			deletedChapters: totalChapters,
			deletedPages: pageRows.filter((r) => r.path).length,
			deletedCovers: totalCovers,
			filesScheduledForDeletion: totalFiles,
			success: true,
		};
	}

	async deleteChapter(chapterId: string): Promise<DeletionResult> {
		this.logger.log(`Deleting chapter: ${chapterId}`);

		const chapter = await this.chapterRepository.findOne({
			where: { id: chapterId },
			relations: ['pages', 'book'],
		});

		if (!chapter) {
			throw new NotFoundException(
				`Chapter with id ${chapterId} not found`,
			);
		}

		const pageFiles = chapter.pages.map((p) => p.path);
		const totalFiles = pageFiles.length;

		try {
			await this.chapterRepository.softRemove(chapter);

			this.eventEmitter.emit('chapter.deleted', {
				chapterId: chapter.id,
				bookId: chapter.book?.id,
				pages: pageFiles,
			});

			this.logger.log(`Chapter deleted successfully: ${chapterId}`);

			return {
				deletedChapters: 1,
				deletedPages: chapter.pages.length,
				filesScheduledForDeletion: totalFiles,
				success: true,
			};
		} catch (error) {
			this.logger.error(`Error deleting chapter ${chapterId}:`, error);
			return {
				filesScheduledForDeletion: 0,
				success: false,
				errors: [(error as Error).message],
			};
		}
	}

	async deleteChapters(chapterIds: string[]): Promise<DeletionResult> {
		this.logger.log(`Deleting ${chapterIds.length} chapters in batch`);

		if (chapterIds.length === 0) {
			throw new BadRequestException('No chapter IDs provided');
		}

		if (chapterIds.length > 100) {
			throw new BadRequestException(
				'Maximum 100 chapters per batch deletion',
			);
		}

		const chapters = await this.chapterRepository.find({
			where: { id: In(chapterIds) },
			relations: ['pages', 'book'],
		});

		if (chapters.length === 0) {
			throw new NotFoundException('No chapters found with provided IDs');
		}

		let totalFiles = 0;
		let totalPages = 0;
		const errors: string[] = [];

		for (const chapter of chapters) {
			const pageFiles = chapter.pages.map((p) => p.path);
			totalFiles += pageFiles.length;
			totalPages += chapter.pages.length;

			try {
				await this.chapterRepository.softRemove(chapter);

				this.eventEmitter.emit('chapter.deleted', {
					chapterId: chapter.id,
					bookId: chapter.book?.id,
					pages: pageFiles,
				});
			} catch (error) {
				this.logger.error(
					`Error deleting chapter ${chapter.id}:`,
					error,
				);
				errors.push(
					`Chapter ${chapter.id}: ${(error as Error).message}`,
				);
			}
		}

		this.logger.log(
			`Batch deletion completed: ${chapters.length} chapters`,
		);

		return {
			deletedChapters: chapters.length,
			deletedPages: totalPages,
			filesScheduledForDeletion: totalFiles,
			success: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
		};
	}

	async deleteCover(coverId: string): Promise<void> {
		this.logger.log(`Deleting cover: ${coverId}`);

		const cover = await this.coverRepository.findOne({
			where: { id: coverId },
		});

		if (!cover) {
			throw new NotFoundException(`Cover with id ${coverId} not found`);
		}

		await this.coverRepository.softRemove(cover);

		this.eventEmitter.emit('cover.deleted', {
			coverId: cover.id,
			url: cover.url,
		});

		this.logger.log(`Cover deleted successfully: ${coverId}`);
	}

	async deleteCovers(coverIds: string[]): Promise<DeletionResult> {
		this.logger.log(`Deleting ${coverIds.length} covers in batch`);

		if (coverIds.length === 0) {
			throw new BadRequestException('No cover IDs provided');
		}

		const covers = await this.coverRepository.find({
			where: { id: In(coverIds) },
		});

		if (covers.length === 0) {
			throw new NotFoundException('No covers found with provided IDs');
		}

		const errors: string[] = [];

		for (const cover of covers) {
			try {
				await this.coverRepository.softRemove(cover);

				this.eventEmitter.emit('cover.deleted', {
					coverId: cover.id,
					url: cover.url,
				});
			} catch (error) {
				this.logger.error(`Error deleting cover ${cover.id}:`, error);
				errors.push(`Cover ${cover.id}: ${(error as Error).message}`);
			}
		}

		return {
			deletedCovers: covers.length,
			filesScheduledForDeletion: covers.length,
			success: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
		};
	}

	async deletePages(chapterId: string, pageIndices: number[]): Promise<void> {
		this.logger.log(`Deleting pages from chapter: ${chapterId}`);

		if (pageIndices.length === 0) {
			throw new BadRequestException('No page indices provided');
		}

		const chapter = await this.chapterRepository.findOne({
			where: { id: chapterId },
			relations: ['pages'],
		});

		if (!chapter) {
			throw new NotFoundException(
				`Chapter with id ${chapterId} not found`,
			);
		}

		const pagesToDelete = chapter.pages.filter((p) =>
			pageIndices.includes(p.index),
		);

		if (pagesToDelete.length === 0) {
			throw new NotFoundException('No pages found with provided indices');
		}

		await this.pageRepository.softRemove(pagesToDelete);

		for (const page of pagesToDelete) {
			this.eventEmitter.emit('page.deleted', {
				pageId: page.id,
				chapterId: chapter.id,
				path: page.path,
			});
		}

		this.logger.log(`${pagesToDelete.length} pages deleted successfully`);
	}

	async listDeletedBooks(): Promise<
		{
			id: string;
			title: string;
			deletedAt: Date;
			chaptersCount: number;
			pagesCount: number;
			coversCount: number;
			totalFiles: number;
		}[]
	> {
		const books = await this.bookRepository
			.createQueryBuilder('book')
			.withDeleted()
			.where('book.deletedAt IS NOT NULL')
			.select(['book.id', 'book.title', 'book.deletedAt'])
			.getMany();

		if (books.length === 0) return [];

		const bookIds = books.map((b) => b.id);

		const [chapterRows, pageRows, coverRows] = await Promise.all([
			this.chapterRepository
				.createQueryBuilder('ch')
				.withDeleted()
				.where('ch.bookId IN (:...bookIds)', { bookIds })
				.andWhere('ch.deletedAt IS NOT NULL')
				.select('ch.bookId', 'bookId')
				.addSelect('COUNT(ch.id)', 'cnt')
				.groupBy('ch.bookId')
				.getRawMany<{ bookId: string; cnt: string }>(),
			this.pageRepository
				.createQueryBuilder('p')
				.withDeleted()
				.innerJoin('p.chapter', 'ch')
				.where('ch.bookId IN (:...bookIds)', { bookIds })
				.andWhere('p.deletedAt IS NOT NULL')
				.select('ch.bookId', 'bookId')
				.addSelect('COUNT(p.id)', 'cnt')
				.groupBy('ch.bookId')
				.getRawMany<{ bookId: string; cnt: string }>(),
			this.coverRepository
				.createQueryBuilder('cv')
				.withDeleted()
				.innerJoin('cv.book', 'bk')
				.where('bk.id IN (:...bookIds)', { bookIds })
				.andWhere('cv.deletedAt IS NOT NULL')
				.select('bk.id', 'bookId')
				.addSelect('COUNT(cv.id)', 'cnt')
				.groupBy('bk.id')
				.getRawMany<{ bookId: string; cnt: string }>(),
		]);

		const chapterCountMap = new Map(
			chapterRows.map((r) => [r.bookId, Number(r.cnt)]),
		);
		const pageCountMap = new Map(
			pageRows.map((r) => [r.bookId, Number(r.cnt)]),
		);
		const coverCountMap = new Map(
			coverRows.map((r) => [r.bookId, Number(r.cnt)]),
		);

		return books.map((book) => {
			const chaptersCount = chapterCountMap.get(book.id) ?? 0;
			const pagesCount = pageCountMap.get(book.id) ?? 0;
			const coversCount = coverCountMap.get(book.id) ?? 0;
			return {
				id: book.id,
				title: book.title,
				deletedAt: book.deletedAt,
				chaptersCount,
				pagesCount,
				coversCount,
				totalFiles: coversCount + pagesCount,
			};
		});
	}

	async listDeletedChapters(): Promise<
		{
			id: string;
			title: string;
			bookId: string | undefined;
			bookTitle: string | undefined;
			deletedAt: Date;
			pagesCount: number;
		}[]
	> {
		const chapters = await this.chapterRepository
			.createQueryBuilder('ch')
			.withDeleted()
			.leftJoinAndSelect('ch.book', 'book')
			.where('ch.deletedAt IS NOT NULL')
			.select([
				'ch.id',
				'ch.title',
				'ch.deletedAt',
				'book.id',
				'book.title',
			])
			.getMany();

		if (chapters.length === 0) return [];

		const chapterIds = chapters.map((c) => c.id);

		const pageCountRows = await this.pageRepository
			.createQueryBuilder('p')
			.withDeleted()
			.innerJoin('p.chapter', 'ch')
			.where('ch.id IN (:...chapterIds)', { chapterIds })
			.andWhere('p.deletedAt IS NOT NULL')
			.select('ch.id', 'chapterId')
			.addSelect('COUNT(p.id)', 'cnt')
			.groupBy('ch.id')
			.getRawMany<{ chapterId: string; cnt: string }>();

		const pageCountMap = new Map(
			pageCountRows.map((r) => [r.chapterId, Number(r.cnt)]),
		);

		return chapters.map((chapter) => ({
			id: chapter.id,
			title: chapter.title,
			bookId: chapter.book?.id,
			bookTitle: chapter.book?.title,
			deletedAt: chapter.deletedAt,
			pagesCount: pageCountMap.get(chapter.id) ?? 0,
		}));
	}

	async listDeletedCovers(): Promise<
		{
			id: string;
			title: string;
			url: string;
			bookId: string | undefined;
			bookTitle: string | undefined;
			deletedAt: Date;
		}[]
	> {
		const covers = await this.coverRepository
			.createQueryBuilder('cv')
			.withDeleted()
			.leftJoinAndSelect('cv.book', 'book')
			.where('cv.deletedAt IS NOT NULL')
			.select([
				'cv.id',
				'cv.title',
				'cv.url',
				'cv.deletedAt',
				'book.id',
				'book.title',
			])
			.getMany();

		return covers.map((cover) => ({
			id: cover.id,
			title: cover.title,
			url: cover.url,
			bookId: cover.book?.id,
			bookTitle: cover.book?.title,
			deletedAt: cover.deletedAt,
		}));
	}

	async listDeletedPages(): Promise<
		{
			id: number;
			index: number;
			path: string;
			chapterId: string | undefined;
			chapterTitle: string | undefined;
			bookId: string | undefined;
			bookTitle: string | undefined;
			deletedAt: Date;
		}[]
	> {
		const pages = await this.pageRepository
			.createQueryBuilder('p')
			.withDeleted()
			.leftJoinAndSelect('p.chapter', 'ch')
			.leftJoinAndSelect('ch.book', 'book')
			.where('p.deletedAt IS NOT NULL')
			.select([
				'p.id',
				'p.index',
				'p.path',
				'p.deletedAt',
				'ch.id',
				'ch.title',
				'book.id',
				'book.title',
			])
			.getMany();

		return pages.map((page) => ({
			id: page.id,
			index: page.index,
			path: page.path,
			chapterId: page.chapter?.id,
			chapterTitle: page.chapter?.title,
			bookId: page.chapter?.book?.id,
			bookTitle: page.chapter?.book?.title,
			deletedAt: page.deletedAt,
		}));
	}
}
