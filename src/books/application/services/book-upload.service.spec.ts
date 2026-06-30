import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getToken } from '@willsoto/nestjs-prometheus';

import { I_BOOK_REPOSITORY } from '@books/application/ports/book-repository.interface';
import { I_CHAPTER_REPOSITORY } from '@books/application/ports/chapter-repository.interface';
import { I_COVER_REPOSITORY } from '@books/application/ports/cover-repository.interface';
import { I_PAGE_REPOSITORY } from '@books/application/ports/page-repository.interface';
import { BookEvents } from '@books/domain/constants/events.constant';
import { ContentFormat } from '@books/domain/enums/content-format.enum';
import { CustomLogger } from 'src/custom.logger';
import { FilesService } from 'src/files/application/services/files.service';
import { BookUploadService } from './book-upload.service';

// Mock util
jest.mock('src/common/utils/image.utils', () => ({
	getImageDimensions: jest
		.fn()
		.mockResolvedValue({ width: 100, height: 100 }),
}));

// Mock p-limit because it is an ESM module and breaks Jest
jest.mock('p-limit', () => () => (fn: any) => fn());

describe('BookUploadService', () => {
	let service: BookUploadService;
	let bookRepository: any;
	let coverRepository: any;
	let pageRepository: any;
	let chapterRepository: any;
	let filesService: any;
	let eventEmitter: any;
	let logger: any;
	let counterMock: any;
	let histogramMock: any;

	beforeEach(async () => {
		bookRepository = {
			findById: jest.fn(),
		};

		coverRepository = {
			findById: jest.fn(),
			create: jest
				.fn()
				.mockImplementation((dto) => ({ id: 'cover-id', ...dto })),
			save: jest
				.fn()
				.mockImplementation((cover) => Promise.resolve(cover)),
			saveAll: jest
				.fn()
				.mockImplementation((covers) => Promise.resolve(covers)),
		};

		pageRepository = {
			create: jest
				.fn()
				.mockImplementation((dto) => ({ id: 'page-id', ...dto })),
			saveAll: jest
				.fn()
				.mockImplementation((pages) => Promise.resolve(pages)),
		};

		chapterRepository = {
			findById: jest.fn(),
			save: jest
				.fn()
				.mockImplementation((chapter) => Promise.resolve(chapter)),
		};

		filesService = {
			saveBufferFile: jest.fn().mockResolvedValue('path/to/file.jpg'),
			deleteFile: jest.fn().mockResolvedValue(undefined),
		};

		eventEmitter = {
			emit: jest.fn(),
		};

		logger = {
			setContext: jest.fn(),
			log: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			logFileUpload: jest.fn(),
			logPerformance: jest.fn(),
			logChapterProcessing: jest.fn(),
		};

		counterMock = {
			inc: jest.fn(),
		};

		histogramMock = {
			observe: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BookUploadService,
				{ provide: I_BOOK_REPOSITORY, useValue: bookRepository },
				{ provide: I_COVER_REPOSITORY, useValue: coverRepository },
				{ provide: I_PAGE_REPOSITORY, useValue: pageRepository },
				{ provide: I_CHAPTER_REPOSITORY, useValue: chapterRepository },
				{ provide: FilesService, useValue: filesService },
				{ provide: EventEmitter2, useValue: eventEmitter },
				{ provide: CustomLogger, useValue: logger },
				{
					provide: getToken('file_uploads_total'),
					useValue: counterMock,
				},
				{
					provide: getToken('file_upload_size_bytes'),
					useValue: histogramMock,
				},
				{
					provide: getToken('file_upload_duration_seconds'),
					useValue: histogramMock,
				},
			],
		}).compile();

		service = module.get<BookUploadService>(BookUploadService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('uploadCover', () => {
		it('should upload a cover successfully', async () => {
			// Arrange
			const bookId = 'book-1';
			const fileMock = {
				originalname: 'cover.jpg',
				mimetype: 'image/jpeg',
				size: 1024,
				buffer: Buffer.from('test'),
			} as any;
			const bookMock = { id: bookId, title: 'Test Book', covers: [] };
			bookRepository.findById.mockResolvedValue(bookMock);

			// Act
			const result = await service.uploadCover(bookId, fileMock);

			// Assert
			expect(bookRepository.findById).toHaveBeenCalledWith(bookId, [
				'covers',
			]);
			expect(filesService.saveBufferFile).toHaveBeenCalled();
			expect(coverRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					title: 'cover.jpg',
					url: 'path/to/file.jpg',
					book: bookMock,
				}),
			);
			expect(coverRepository.save).toHaveBeenCalled();
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				BookEvents.COVER_UPLOADED,
				expect.any(Object),
			);
			expect(result.url).toBe('path/to/file.jpg');
		});

		it('should throw NotFoundException if book does not exist', async () => {
			// Arrange
			const fileMock = {
				originalname: 'cover.jpg',
				mimetype: 'image/jpeg',
				size: 1024,
				buffer: Buffer.from('test'),
			} as any;
			bookRepository.findById.mockResolvedValue(null);

			// Act & Assert
			await expect(
				service.uploadCover('book-1', fileMock),
			).rejects.toThrow(NotFoundException);
		});

		it('should throw BadRequestException if file is not an image', async () => {
			// Arrange
			const bookId = 'book-1';
			const fileMock = {
				originalname: 'cover.pdf',
				mimetype: 'application/pdf',
				size: 1024,
				buffer: Buffer.from('test'),
			} as any;
			bookRepository.findById.mockResolvedValue({
				id: bookId,
				covers: [],
			});

			// Act & Assert
			await expect(service.uploadCover(bookId, fileMock)).rejects.toThrow(
				BadRequestException,
			);
		});
	});

	describe('uploadChapterPages', () => {
		it('should upload chapter pages successfully', async () => {
			// Arrange
			const chapterId = 'chapter-1';
			const files = [
				{
					originalname: '1.jpg',
					mimetype: 'image/jpeg',
					size: 1024,
					buffer: Buffer.from('test1'),
				} as any,
			];
			const indices = [1];
			const chapterMock = {
				id: chapterId,
				pages: [],
				book: { id: 'book-1' },
			};
			chapterRepository.findById.mockResolvedValue(chapterMock);

			// Act
			const result = await service.uploadChapterPages(
				chapterId,
				files,
				indices,
			);

			// Assert
			expect(chapterRepository.findById).toHaveBeenCalledWith(chapterId, [
				'pages',
				'book',
			]);
			expect(pageRepository.create).toHaveBeenCalled();
			expect(pageRepository.saveAll).toHaveBeenCalled();
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				BookEvents.PAGES_UPLOADED,
				expect.any(Object),
			);
			expect(result).toBeDefined();
		});

		it('should throw BadRequestException if lengths do not match', async () => {
			// Arrange
			const files = [{} as any];
			const indices = [1, 2];

			// Act & Assert
			await expect(
				service.uploadChapterPages('chapter-1', files, indices),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('uploadChapterTextContent', () => {
		it('should upload text content successfully', async () => {
			// Arrange
			const chapterId = 'chapter-1';
			const dto = { format: ContentFormat.HTML, content: '<p>test</p>' };
			const chapterMock = {
				id: chapterId,
				book: { id: 'book-1' },
				documentPath: null,
			};
			chapterRepository.findById.mockResolvedValue(chapterMock);

			// Act
			const result = await service.uploadChapterTextContent(
				chapterId,
				dto,
			);

			// Assert
			expect(chapterRepository.findById).toHaveBeenCalledWith(chapterId, [
				'book',
			]);
			expect(chapterRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					content: '<p>test</p>',
					contentFormat: ContentFormat.HTML,
				}),
			);
			expect(result.content).toBe('<p>test</p>');
		});

		it('should delete previous document if it exists', async () => {
			// Arrange
			const chapterId = 'chapter-1';
			const dto = { format: ContentFormat.HTML, content: '<p>test</p>' };
			const chapterMock = {
				id: chapterId,
				book: { id: 'book-1' },
				documentPath: 'old/doc.pdf',
			};
			chapterRepository.findById.mockResolvedValue(chapterMock);

			// Act
			await service.uploadChapterTextContent(chapterId, dto);

			// Assert
			expect(filesService.deleteFile).toHaveBeenCalledWith(
				'old/doc.pdf',
				expect.any(String),
			);
		});
	});
});
