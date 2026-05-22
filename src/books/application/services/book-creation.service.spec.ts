import { CreateBookDto } from '@books/application/dto/create-book.dto';
import { I_BOOK_REPOSITORY } from '@books/application/ports/book-repository.interface';
import { AlternativeTitle } from '@books/domain/entities/alternative-title';
import { BookType } from '@books/domain/enums/book-type.enum';
import { CoverImageService } from '@books/infrastructure/jobs/cover-image.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { WebsiteService } from '@websites/application/services/website.service';
import { I_UNIT_OF_WORK } from 'src/common/application/ports/unit-of-work.interface';
import { BookCreationService } from './book-creation.service';
import { BookRelationshipService } from './book-relationship.service';
import { ChapterManagementService } from './chapter-management.service';

describe('BookCreationService - Alternative Titles', () => {
	let service: BookCreationService;
	let bookRepository: any;

	beforeEach(async () => {
		bookRepository = {
			checkBookTitleConflict: jest
				.fn()
				.mockResolvedValue({ conflict: false }),
			save: jest.fn().mockImplementation((book) => Promise.resolve(book)),
		};

		const unitOfWork = {
			runInTransaction: jest.fn().mockImplementation((cb) =>
				cb({
					getBookRepository: () => bookRepository,
					getTagRepository: () => ({
						findOrCreateTags: jest.fn().mockResolvedValue([]),
					}),
					getAuthorRepository: () => ({
						findOrCreateAuthors: jest.fn().mockResolvedValue([]),
					}),
					getSensitiveContentRepository: () => ({
						findOrCreateSensitiveContent: jest
							.fn()
							.mockResolvedValue([]),
					}),
					getChapterRepository: () => ({
						saveAll: jest.fn().mockResolvedValue([]),
					}),
					getCoverRepository: () => ({
						saveAll: jest.fn().mockResolvedValue([]),
					}),
				}),
			),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BookCreationService,
				{ provide: I_BOOK_REPOSITORY, useValue: bookRepository },
				{ provide: I_UNIT_OF_WORK, useValue: unitOfWork },
				{
					provide: 'SCRAPER_SERVICE',
					useValue: {
						connect: jest.fn().mockResolvedValue({}),
						emit: jest
							.fn()
							.mockReturnValue({ subscribe: jest.fn() }),
					},
				},
				{ provide: WebsiteService, useValue: {} },
				{
					provide: BookRelationshipService,
					useValue: {
						findOrCreateTags: jest.fn().mockResolvedValue([]),
						findOrCreateAuthors: jest.fn().mockResolvedValue([]),
						findOrCreateSensitiveContent: jest
							.fn()
							.mockResolvedValue([]),
					},
				},
				{ provide: ChapterManagementService, useValue: {} },
				{
					provide: CoverImageService,
					useValue: { addCoverToQueue: jest.fn() },
				},
				{ provide: EventEmitter2, useValue: { emit: jest.fn() } },
			],
		}).compile();

		service = module.get<BookCreationService>(BookCreationService);
	});

	it('should consolidate alternative titles from legacy array of strings', async () => {
		const dto = new CreateBookDto();
		dto.title = 'Main Title';
		dto.alternativeTitle = ['Alt 1', 'Alt 2'];
		dto.type = BookType.MANGA;

		const result = await service.createBook(dto);

		expect(result.alternativeTitles).toBeDefined();
		expect(result.alternativeTitles).toHaveLength(2);
		expect(result.alternativeTitles[0]).toBeInstanceOf(AlternativeTitle);
		expect(result.alternativeTitles[0].title).toBe('Alt 1');
		expect(result.alternativeTitles[1].title).toBe('Alt 2');
	});

	it('should consolidate alternative titles from new field with mixed content', async () => {
		const dto = new CreateBookDto();
		dto.title = 'Main Title';
		dto.type = BookType.MANGA;
		// @ts-ignore - simulating dynamic input
		dto.alternativeTitles = [
			'String Alt',
			{ title: 'Object Alt', languageCode: 'ja-JP' },
		];

		const result = await service.createBook(dto);

		expect(result.alternativeTitles).toHaveLength(2);
		expect(result.alternativeTitles[0].title).toBe('String Alt');
		expect(result.alternativeTitles[1].title).toBe('Object Alt');
		expect(result.alternativeTitles[1].languageCode).toBe('ja-JP');
	});
});
