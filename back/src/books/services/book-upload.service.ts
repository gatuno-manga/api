import {
	Injectable,
	NotFoundException,
	BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import { Book } from '../entitys/book.entity';
import { Cover } from '../entitys/cover.entity';
import { Page } from '../entitys/page.entity';
import { Chapter } from '../entitys/chapter.entity';
import { FilesService } from 'src/files/files.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CustomLogger } from 'src/custom.logger';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';

/**
 * Service responsável por upload de capas e páginas de capítulos
 */
@Injectable()
export class BookUploadService {
	constructor(
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		@InjectRepository(Cover)
		private readonly coverRepository: Repository<Cover>,
		@InjectRepository(Page)
		private readonly pageRepository: Repository<Page>,
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		private readonly filesService: FilesService,
		private readonly eventEmitter: EventEmitter2,
		private readonly logger: CustomLogger,
		@InjectMetric('file_uploads_total')
		private readonly uploadCounter: Counter,
		@InjectMetric('file_upload_size_bytes')
		private readonly uploadSize: Histogram,
		@InjectMetric('file_upload_duration_seconds')
		private readonly uploadDuration: Histogram,
	) {
		this.logger.setContext('BookUploadService');
	}

	/**
	 * Upload de uma única capa para um livro
	 */
	async uploadCover(
		bookId: string,
		file: Express.Multer.File,
		title?: string,
	): Promise<Cover> {
		const startTime = Date.now();

		this.logger.logFileUpload({
			fileName: file.originalname,
			message: 'Starting cover upload',
			metadata: {
				bookId,
				fileSize: file.size,
				mimeType: file.mimetype,
			},
		});

		this.uploadSize.observe({ type: 'cover' }, file.size);

		const book = await this.bookRepository.findOne({
			where: { id: bookId },
			relations: ['covers'],
		});

		if (!book) {
			this.logger.warn(
				`Book with id ${bookId} not found`,
				'BookUploadService',
			);
			this.uploadCounter.inc({ type: 'cover', status: 'error' });
			throw new NotFoundException(`Book with id ${bookId} not found`);
		}

		if (!file.mimetype.match(/^image\//)) {
			this.uploadCounter.inc({ type: 'cover', status: 'error' });
			throw new BadRequestException('Only image files are allowed');
		}

		try {
			const extension = path.extname(file.originalname) || '.jpg';

			const savedPath = await this.filesService.saveBufferFile(
				file.buffer,
				extension,
			);

			const cover = this.coverRepository.create({
				title: title || file.originalname,
				url: savedPath,
				book: book,
				selected: book.covers.length === 0,
			});

			const savedCover = await this.coverRepository.save(cover);

			const duration = Date.now() - startTime;

			this.uploadCounter.inc({ type: 'cover', status: 'success' });
			this.uploadDuration.observe({ type: 'cover' }, duration / 1000);

			this.logger.logFileUpload({
				fileName: file.originalname,
				message: 'Cover uploaded successfully',
				metadata: {
					bookId: book.id,
					bookTitle: book.title,
					coverId: savedCover.id,
					duration,
				},
			});

			this.logger.logPerformance({
				operation: 'cover_upload',
				duration,
				metadata: {
					bookId,
					fileSize: file.size,
				},
			});

			this.eventEmitter.emit('cover.uploaded', {
				bookId: book.id,
				coverId: savedCover.id,
				url: savedPath,
			});

			return savedCover;
		} catch (error) {
			const duration = Date.now() - startTime;
			this.uploadCounter.inc({ type: 'cover', status: 'error' });
			this.uploadDuration.observe({ type: 'cover' }, duration / 1000);

			this.logger.error(error, 'BookUploadService', {
				bookId,
				fileName: file.originalname,
			});
			throw error;
		}
	}

	/**
	 * Substitui a imagem de uma capa existente
	 */
	async replaceCoverImage(
		bookId: string,
		coverId: string,
		file: Express.Multer.File,
		title?: string,
	): Promise<Cover> {
		const startTime = Date.now();

		this.logger.logFileUpload({
			fileName: file.originalname,
			message: 'Starting cover image replacement',
			metadata: {
				bookId,
				coverId,
				fileSize: file.size,
				mimeType: file.mimetype,
			},
		});

		this.uploadSize.observe({ type: 'cover_replace' }, file.size);

		const cover = await this.coverRepository.findOne({
			where: { id: coverId, book: { id: bookId } },
			relations: ['book'],
		});

		if (!cover) {
			this.logger.warn(
				`Cover with id ${coverId} not found for book ${bookId}`,
				'BookUploadService',
			);
			this.uploadCounter.inc({ type: 'cover_replace', status: 'error' });
			throw new NotFoundException(
				`Cover with id ${coverId} not found for book ${bookId}`,
			);
		}

		if (!file.mimetype.match(/^image\//)) {
			this.uploadCounter.inc({ type: 'cover_replace', status: 'error' });
			throw new BadRequestException('Only image files are allowed');
		}

		try {
			// Delete old image file if exists
			if (cover.url) {
				try {
					await this.filesService.deleteFile(cover.url);
				} catch (deleteError) {
					this.logger.warn(
						`Failed to delete old cover image: ${cover.url}`,
						'BookUploadService',
					);
				}
			}

			const extension = path.extname(file.originalname) || '.jpg';
			const savedPath = await this.filesService.saveBufferFile(
				file.buffer,
				extension,
			);

			cover.url = savedPath;
			if (title !== undefined) {
				cover.title = title;
			}

			const updatedCover = await this.coverRepository.save(cover);

			const duration = Date.now() - startTime;

			this.uploadCounter.inc({
				type: 'cover_replace',
				status: 'success',
			});
			this.uploadDuration.observe(
				{ type: 'cover_replace' },
				duration / 1000,
			);

			this.logger.logFileUpload({
				fileName: file.originalname,
				message: 'Cover image replaced successfully',
				metadata: {
					bookId,
					coverId,
					duration,
				},
			});

			this.eventEmitter.emit('cover.updated', {
				bookId,
				coverId,
				url: savedPath,
			});

			return updatedCover;
		} catch (error) {
			const duration = Date.now() - startTime;
			this.uploadCounter.inc({ type: 'cover_replace', status: 'error' });
			this.uploadDuration.observe(
				{ type: 'cover_replace' },
				duration / 1000,
			);

			this.logger.error(error, 'BookUploadService', {
				bookId,
				coverId,
				fileName: file.originalname,
			});
			throw error;
		}
	}

	/**
	 * Upload de múltiplas capas para um livro
	 */
	async uploadMultipleCovers(
		bookId: string,
		files: Express.Multer.File[],
	): Promise<Cover[]> {
		const startTime = Date.now();

		this.logger.log(
			`Uploading ${files.length} covers for book: ${bookId}`,
			'BookUploadService',
		);

		if (files.length === 0) {
			throw new BadRequestException('No files provided');
		}

		if (files.length > 10) {
			throw new BadRequestException('Maximum 10 covers per upload');
		}

		const book = await this.bookRepository.findOne({
			where: { id: bookId },
			relations: ['covers'],
		});

		if (!book) {
			this.logger.warn(
				`Book with id ${bookId} not found`,
				'BookUploadService',
			);
			throw new NotFoundException(`Book with id ${bookId} not found`);
		}

		try {
			const covers = await Promise.all(
				files.map(async (file, index) => {
					if (!file.mimetype.match(/^image\//)) {
						throw new BadRequestException(
							`File ${file.originalname} is not an image`,
						);
					}

					const extension = path.extname(file.originalname) || '.jpg';
					const savedPath = await this.filesService.saveBufferFile(
						file.buffer,
						extension,
					);

					return this.coverRepository.create({
						title: file.originalname,
						url: savedPath,
						book: book,
						selected: book.covers.length === 0 && index === 0,
					});
				}),
			);

			const savedCovers = await this.coverRepository.save(covers);

			const duration = Date.now() - startTime;

			this.logger.logPerformance({
				operation: 'multiple_covers_upload',
				duration,
				metadata: {
					bookId,
					coversCount: savedCovers.length,
					totalSize: files.reduce((sum, f) => sum + f.size, 0),
				},
			});

			this.logger.log(
				`${savedCovers.length} covers uploaded successfully for book: ${book.title}`,
				'BookUploadService',
			);

			this.eventEmitter.emit('covers.uploaded', {
				bookId: book.id,
				count: savedCovers.length,
				coverIds: savedCovers.map((c) => c.id),
			});

			return savedCovers;
		} catch (error) {
			this.logger.error(error, 'BookUploadService', {
				bookId,
				filesCount: files.length,
			});
			throw error;
		}
	}

	/**
	 * Upload de páginas para um capítulo
	 */
	async uploadChapterPages(
		chapterId: string,
		files: Express.Multer.File[],
		indices: number[],
	): Promise<Page[]> {
		const startTime = Date.now();

		this.logger.logChapterProcessing({
			chapterId,
			message: `Starting upload of ${files.length} pages`,
			metadata: {
				filesCount: files.length,
				indicesCount: indices.length,
			},
		});

		if (files.length === 0) {
			throw new BadRequestException('No files provided');
		}

		if (files.length !== indices.length) {
			throw new BadRequestException(
				'Number of files must match number of indices',
			);
		}

		if (files.length > 100) {
			throw new BadRequestException('Maximum 100 pages per upload');
		}

		const uniqueIndices = new Set(indices);
		if (uniqueIndices.size !== indices.length) {
			throw new BadRequestException('Duplicate indices found');
		}

		const chapter = await this.chapterRepository.findOne({
			where: { id: chapterId },
			relations: ['pages', 'book'],
		});

		if (!chapter) {
			this.logger.warn(
				`Chapter with id ${chapterId} not found`,
				'BookUploadService',
			);
			throw new NotFoundException(
				`Chapter with id ${chapterId} not found`,
			);
		}

		const existingIndices = chapter.pages.map((p) => p.index);
		const conflictingIndices = indices.filter((i) =>
			existingIndices.includes(i),
		);

		if (conflictingIndices.length > 0) {
			throw new BadRequestException(
				`Pages with indices ${conflictingIndices.join(', ')} already exist`,
			);
		}

		try {
			const pages = await Promise.all(
				files.map(async (file, i) => {
					if (!file.mimetype.match(/^image\//)) {
						throw new BadRequestException(
							`File ${file.originalname} is not an image`,
						);
					}

					const extension = path.extname(file.originalname) || '.jpg';
					const savedPath = await this.filesService.saveBufferFile(
						file.buffer,
						extension,
					);

					return this.pageRepository.create({
						index: indices[i],
						path: savedPath,
						chapter: chapter,
					});
				}),
			);

			const savedPages = await this.pageRepository.save(pages);

			const duration = Date.now() - startTime;

			this.logger.logChapterProcessing({
				chapterId,
				message: 'Pages uploaded successfully',
				metadata: {
					pagesCount: savedPages.length,
					duration,
					bookId: chapter.book?.id,
					totalSize: files.reduce((sum, f) => sum + f.size, 0),
				},
			});

			this.logger.logPerformance({
				operation: 'chapter_pages_upload',
				duration,
				metadata: {
					chapterId,
					pagesCount: savedPages.length,
				},
			});

			this.eventEmitter.emit('chapter.pages.uploaded', {
				chapterId: chapter.id,
				bookId: chapter.book?.id,
				count: savedPages.length,
			});

			return savedPages;
		} catch (error) {
			this.logger.error(error, 'BookUploadService', {
				chapterId,
				filesCount: files.length,
			});
			throw error;
		}
	}
}
