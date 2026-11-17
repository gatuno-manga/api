import { MEILI_CLIENT } from '@/infrastructure/meilisearch/meilisearch.constants';
import { I_AUTHOR_REPOSITORY } from '@books/application/ports/author-repository.interface';
import { I_BOOK_REPOSITORY } from '@books/application/ports/book-repository.interface';
import { I_CHAPTER_REPOSITORY } from '@books/application/ports/chapter-repository.interface';
import { I_COVER_REPOSITORY } from '@books/application/ports/cover-repository.interface';
import { I_PAGE_REPOSITORY } from '@books/application/ports/page-repository.interface';
import { I_SENSITIVE_CONTENT_REPOSITORY } from '@books/application/ports/sensitive-content-repository.interface';
import { I_TAG_REPOSITORY } from '@books/application/ports/tag-repository.interface';
import { BookOrderField } from '@books/domain/enums/book-order-field.enum';
import { InvalidBookListCursorException } from '@books/domain/exceptions/invalid-book-list-cursor.exception';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderDirection } from 'src/common/enum/order-direction.enum';
import { PaginationMode } from 'src/common/enum/pagination-mode.enum';
import { CursorPageDto } from 'src/common/pagination/cursor-page.dto';
import { PageDto } from 'src/common/pagination/page.dto';
import { MediaUrlService } from 'src/common/services/media-url.service';
import { UserAccessPolicyService } from 'src/users/application/use-cases/user-access-policy.service';
import { BookPageOptionsDto } from '../dto/book-page-options.dto';
import {
	decodeBookListCursor,
	encodeKeysetCursor,
	encodeSearchCursor,
} from '../utils/book-list-cursor';
import { BookQueryService } from './book-query.service';
import { SensitiveContentService } from './sensitive-content.service';

describe('BookQueryService (Search Optimization)', () => {
	let service: BookQueryService;
	let meiliClient: any;
	let bookRepository: any;
	let chapterRepository: any;
	let coverRepository: any;
	let userAccessPolicyService: any;

	beforeEach(async () => {
		meiliClient = {
			index: jest.fn().mockReturnValue({
				search: jest.fn().mockResolvedValue({
					hits: [{ id: 'book-1' }],
					estimatedTotalHits: 1,
				}),
			}),
		};

		bookRepository = {
			findByIdsPreservingOrder: jest
				.fn()
				.mockResolvedValue([
					{ id: 'book-1', title: 'Solo Leveling', covers: [] },
				]),
			findWithFilters: jest.fn(),
			findWithFiltersAfter: jest.fn().mockResolvedValue([]),
			findBooksWithCoverIssues: jest.fn(),
			loadListRelations: jest.fn(async (books: object[]) =>
				books.map((book) => ({
					...book,
					tags: [],
					authors: [],
					sensitiveContent: [],
				})),
			),
		};

		userAccessPolicyService = {
			evaluateListAccessContext: jest.fn().mockResolvedValue({
				effectiveMaxWeightSensitiveContent: 0,
			}),
		};

		chapterRepository = {
			findStuckChapters: jest.fn().mockResolvedValue([]),
		};

		coverRepository = {
			findStuckCovers: jest.fn().mockResolvedValue([]),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BookQueryService,
				{ provide: I_BOOK_REPOSITORY, useValue: bookRepository },
				{ provide: MEILI_CLIENT, useValue: meiliClient },
				{
					provide: UserAccessPolicyService,
					useValue: userAccessPolicyService,
				},
				{
					provide: MediaUrlService,
					useValue: { resolveUrl: jest.fn() },
				},
				{ provide: I_CHAPTER_REPOSITORY, useValue: chapterRepository },
				{ provide: I_COVER_REPOSITORY, useValue: coverRepository },
				{ provide: I_PAGE_REPOSITORY, useValue: {} },
				{ provide: I_TAG_REPOSITORY, useValue: {} },
				{ provide: I_AUTHOR_REPOSITORY, useValue: {} },
				{ provide: I_SENSITIVE_CONTENT_REPOSITORY, useValue: {} },
				{ provide: SensitiveContentService, useValue: {} },
				{ provide: getQueueToken('book-update-queue'), useValue: {} },
				{ provide: getQueueToken('chapter-scraping'), useValue: {} },
				{ provide: getQueueToken('cover-image-queue'), useValue: {} },
				{ provide: getQueueToken('fix-chapter-queue'), useValue: {} },
			],
		}).compile();

		service = module.get<BookQueryService>(BookQueryService);
	});

	it('should use Meilisearch when search term is provided', async () => {
		const options = new BookPageOptionsDto();
		options.search = 'Solo';
		options.page = 1;
		Object.assign(options, { limit: 10 });

		const result = await service.getAllBooks(options, 0, 'user-1', []);

		expect(meiliClient.index).toHaveBeenCalledWith('books');
		expect(meiliClient.index('books').search).toHaveBeenCalledWith(
			'Solo',
			expect.objectContaining({ limit: 10, offset: 0 }),
		);
		expect(bookRepository.findByIdsPreservingOrder).toHaveBeenCalledWith([
			'book-1',
		]);
		expect(result.data[0].id).toBe('book-1');
	});

	it('should format sort direction as lowercase for Meilisearch', async () => {
		const options = new BookPageOptionsDto();
		options.search = 'Solo';
		options.orderBy = 'createdAt' as any;
		options.order = 'DESC' as any;

		await service.getAllBooks(options, 0, 'user-1', []);

		expect(meiliClient.index('books').search).toHaveBeenCalledWith(
			'Solo',
			expect.objectContaining({
				sort: ['createdAt:desc'],
			}),
		);
	});

	it('should NOT use Meilisearch when no search term is provided', async () => {
		const options = new BookPageOptionsDto();
		options.search = undefined;

		bookRepository.findWithFilters.mockResolvedValue([[], 0]);

		await service.getAllBooks(options, 0, 'user-1', []);

		expect(meiliClient.index).not.toHaveBeenCalled();
		expect(bookRepository.findWithFilters).toHaveBeenCalled();
	});

	it('should fallback to MySQL if Meilisearch fails', async () => {
		const options = new BookPageOptionsDto();
		options.search = 'Solo';

		meiliClient.index().search.mockRejectedValue(new Error('Meili Down'));
		bookRepository.findWithFilters.mockResolvedValue([
			[{ id: 'fallback-book', covers: [] }],
			1,
		]);

		const result = await service.getAllBooks(options, 0, 'user-1', []);

		expect(bookRepository.findWithFilters).toHaveBeenCalled();
		expect(result.data[0].id).toBe('fallback-book');
	});

	describe('classification on list items (offline filtering)', () => {
		const tag = { id: 'tag-1', name: 'Action' };
		const author = { id: 'author-1', name: 'Chugong' };
		const sensitiveContent = { id: 'sc-1', name: 'Gore', weight: 3 };

		beforeEach(() => {
			bookRepository.loadListRelations.mockImplementation(
				async (books: object[]) =>
					books.map((book) => ({
						...book,
						tags: [tag],
						authors: [author],
						sensitiveContent: [sensitiveContent],
					})),
			);
		});

		it('should return tags, authors and sensitiveContent on search results so clients can filter them locally', async () => {
			// Arrange
			const options = new BookPageOptionsDto();
			options.search = 'Solo';

			// Act
			const result = await service.getAllBooks(options, 0, 'user-1', []);

			// Assert
			expect(bookRepository.loadListRelations).toHaveBeenCalledWith([
				expect.objectContaining({ id: 'book-1' }),
			]);
			expect(result.data[0]).toEqual(
				expect.objectContaining({
					id: 'book-1',
					tags: [tag],
					authors: [author],
					sensitiveContent: [sensitiveContent],
				}),
			);
		});

		it('should return tags, authors and sensitiveContent on database results so clients can filter them locally', async () => {
			// Arrange
			const options = new BookPageOptionsDto();
			options.search = undefined;
			bookRepository.findWithFilters.mockResolvedValue([
				[{ id: 'db-book', covers: [] }],
				1,
			]);

			// Act
			const result = await service.getAllBooks(options, 0, 'user-1', []);

			// Assert
			expect(bookRepository.loadListRelations).toHaveBeenCalledWith([
				expect.objectContaining({ id: 'db-book' }),
			]);
			expect(result.data[0]).toEqual(
				expect.objectContaining({
					id: 'db-book',
					tags: [tag],
					authors: [author],
					sensitiveContent: [sensitiveContent],
				}),
			);
		});

		it('should retry through the MySQL path when the search path cannot load the classification', async () => {
			// Arrange
			const options = new BookPageOptionsDto();
			options.search = 'Solo';
			bookRepository.findWithFilters.mockResolvedValue([
				[{ id: 'db-book', covers: [] }],
				1,
			]);
			bookRepository.loadListRelations.mockRejectedValueOnce(
				new Error('relation query failed'),
			);

			// Act
			const result = await service.getAllBooks(options, 0, 'user-1', []);

			// Assert
			expect(bookRepository.findWithFilters).toHaveBeenCalled();
			expect(result.data[0]).toEqual(
				expect.objectContaining({
					id: 'db-book',
					tags: [tag],
					authors: [author],
					sensitiveContent: [sensitiveContent],
				}),
			);
		});

		it('should fail a search request when the classification cannot be loaded on either path', async () => {
			// Arrange
			const options = new BookPageOptionsDto();
			options.search = 'Solo';
			bookRepository.findWithFilters.mockResolvedValue([
				[{ id: 'db-book', covers: [] }],
				1,
			]);
			bookRepository.loadListRelations.mockRejectedValue(
				new Error('relation query failed'),
			);

			// Act
			const request = service.getAllBooks(options, 0, 'user-1', []);

			// Assert
			await expect(request).rejects.toThrow('relation query failed');
		});

		it('should fail the request when the classification cannot be loaded, instead of returning items a client would misfilter', async () => {
			// Arrange
			const options = new BookPageOptionsDto();
			options.search = undefined;
			bookRepository.findWithFilters.mockResolvedValue([
				[{ id: 'db-book', covers: [] }],
				1,
			]);
			bookRepository.loadListRelations.mockRejectedValue(
				new Error('relation query failed'),
			);

			// Act
			const request = service.getAllBooks(options, 0, 'user-1', []);

			// Assert
			await expect(request).rejects.toThrow('relation query failed');
		});
	});

	describe('unclassified books on list items', () => {
		it.each([
			['search', 'Solo'],
			['database', undefined],
		])(
			'should send empty arrays on the %s path so clients read "none", not "unknown"',
			async (_path, search) => {
				// Arrange
				const options = new BookPageOptionsDto();
				options.search = search;
				bookRepository.findWithFilters.mockResolvedValue([
					[{ id: 'book-1', covers: [] }],
					1,
				]);

				// Act
				const result = await service.getAllBooks(
					options,
					0,
					'user-1',
					[],
				);

				// Assert
				expect(result.data[0]).toEqual(
					expect.objectContaining({
						tags: [],
						authors: [],
						sensitiveContent: [],
					}),
				);
			},
		);
	});

	describe('cover variant selection on listing', () => {
		it('should serve the smallest variant when the cover has variants', async () => {
			const options = new BookPageOptionsDto();
			options.search = undefined;

			bookRepository.findWithFilters.mockResolvedValue([
				[
					{
						id: 'book-1',
						covers: [
							{
								url: 'ab/original.webp',
								metadata: { width: 1920, height: 2841 },
								variants: [
									{
										width: 600,
										path: 'ab/original_w600.webp',
										metadata: { width: 600, height: 888 },
									},
									{
										width: 300,
										path: 'ab/original_w300.webp',
										metadata: { width: 300, height: 444 },
									},
								],
							},
						],
					},
				],
				1,
			]);

			const mediaUrlService = (service as any).mediaUrlService;
			mediaUrlService.resolveUrl.mockImplementation(
				(path: string) => `https://cdn/${path}`,
			);

			const result = await service.getAllBooks(options, 0, 'user-1', []);

			expect(mediaUrlService.resolveUrl).toHaveBeenCalledWith(
				'ab/original_w300.webp',
				'books',
			);
			expect((result.data[0] as any).cover).toBe(
				'https://cdn/ab/original_w300.webp',
			);
			expect((result.data[0] as any).coverMetadata).toEqual({
				width: 300,
				height: 444,
			});
		});

		it('should fall back to the original cover when there are no variants', async () => {
			const options = new BookPageOptionsDto();
			options.search = undefined;

			bookRepository.findWithFilters.mockResolvedValue([
				[
					{
						id: 'book-1',
						covers: [
							{
								url: 'ab/original.webp',
								metadata: { width: 1920, height: 2841 },
								variants: null,
							},
						],
					},
				],
				1,
			]);

			const mediaUrlService = (service as any).mediaUrlService;
			mediaUrlService.resolveUrl.mockImplementation(
				(path: string) => `https://cdn/${path}`,
			);

			const result = await service.getAllBooks(options, 0, 'user-1', []);

			expect(mediaUrlService.resolveUrl).toHaveBeenCalledWith(
				'ab/original.webp',
				'books',
			);
			expect((result.data[0] as any).cover).toBe(
				'https://cdn/ab/original.webp',
			);
			expect((result.data[0] as any).coverMetadata).toEqual({
				width: 1920,
				height: 2841,
			});
		});
	});

	describe('cursor pagination', () => {
		const createdAtDesc = {
			orderBy: BookOrderField.CREATED_AT,
			order: OrderDirection.DESC,
			search: null,
		};
		const soloSearch = { ...createdAtDesc, search: 'Solo' };
		const positionOf = (index: number) => ({
			sortValue: `2026-01-01 10:00:0${index}.000001`,
			createdAt: `2026-01-01 10:00:0${index}.000001`,
			id: `0190a2b4-0000-7000-8000-00000000000${index}`,
		});
		const positioned = (count: number) =>
			Array.from({ length: count }, (_, index) => ({
				book: { id: `book-${index}`, covers: [] },
				position: positionOf(index),
			}));
		const cursorOptions = (overrides: Partial<BookPageOptionsDto> = {}) => {
			const options = new BookPageOptionsDto();
			Object.assign(options, {
				limit: 5,
				paginationMode: PaginationMode.CURSOR,
				...overrides,
			});
			return options;
		};

		it('should keep offset paging with totals when cursor mode is not requested, so existing clients are unaffected', async () => {
			// Arrange
			const options = new BookPageOptionsDto();
			bookRepository.findWithFilters.mockResolvedValue([[], 0]);

			// Act
			const result = await service.getAllBooks(options, 0, 'user-1', []);

			// Assert
			expect(result).toBeInstanceOf(PageDto);
			expect(bookRepository.findWithFiltersAfter).not.toHaveBeenCalled();
		});

		it('should return the first cursor page without a cursor, fetching one extra row to know whether more exist, and run no COUNT', async () => {
			// Arrange
			bookRepository.findWithFiltersAfter.mockResolvedValue(
				positioned(6),
			);

			// Act
			const result = (await service.getAllBooks(
				cursorOptions({ page: 3 }),
				0,
				'user-1',
				[],
			)) as CursorPageDto<{ id: string }>;

			// Assert
			expect(bookRepository.findWithFiltersAfter).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				[],
				null,
				6,
			);
			expect(bookRepository.findWithFilters).not.toHaveBeenCalled();
			expect(result).toBeInstanceOf(CursorPageDto);
			expect(result.data.map((book) => book.id)).toEqual([
				'book-0',
				'book-1',
				'book-2',
				'book-3',
				'book-4',
			]);
			expect(result.hasNextPage).toBe(true);
			expect(
				decodeBookListCursor(
					result.nextCursor ?? undefined,
					createdAtDesc,
				),
			).toEqual({ walk: 'keyset', after: positionOf(4) });
		});

		it('should continue after the position of the cursor it receives', async () => {
			// Arrange
			const cursor = encodeKeysetCursor(createdAtDesc, positionOf(4));

			// Act
			await service.getAllBooks(
				cursorOptions({ paginationMode: undefined, cursor }),
				0,
				'user-1',
				[],
			);

			// Assert
			expect(bookRepository.findWithFiltersAfter).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				[],
				positionOf(4),
				6,
			);
		});

		it('should fall back to a page of 20 when a caller passes no limit, instead of fetching NaN rows', async () => {
			// Arrange
			const options = cursorOptions();
			Object.assign(options, { limit: undefined });

			// Act
			await service.getAllBooks(options, 0, 'user-1', []);

			// Assert
			expect(bookRepository.findWithFiltersAfter).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				[],
				null,
				21,
			);
		});

		it('should end the walk with no cursor on the last page, so the client stops loading', async () => {
			// Arrange
			bookRepository.findWithFiltersAfter.mockResolvedValue(
				positioned(2),
			);

			// Act
			const result = (await service.getAllBooks(
				cursorOptions(),
				0,
				'user-1',
				[],
			)) as CursorPageDto<{ id: string }>;

			// Assert
			expect(result.data).toHaveLength(2);
			expect(result.hasNextPage).toBe(false);
			expect(result.nextCursor).toBeNull();
		});

		it('should return the classification on cursor pages too, so offline filtering works for every list item', async () => {
			// Arrange
			bookRepository.findWithFiltersAfter.mockResolvedValue(
				positioned(1),
			);

			// Act
			const result = await service.getAllBooks(
				cursorOptions(),
				0,
				'user-1',
				[],
			);

			// Assert
			expect(bookRepository.loadListRelations).toHaveBeenCalledWith([
				expect.objectContaining({ id: 'book-0' }),
			]);
			expect(result.data[0]).toEqual(
				expect.objectContaining({
					tags: [],
					authors: [],
					sensitiveContent: [],
				}),
			);
		});

		it('should reject a cursor issued for another sort before touching the database', async () => {
			// Arrange
			const cursor = encodeKeysetCursor(createdAtDesc, positionOf(4));
			const options = cursorOptions({
				cursor,
				orderBy: BookOrderField.TITLE,
			});

			// Act
			const request = service.getAllBooks(options, 0, 'user-1', []);

			// Assert
			await expect(request).rejects.toThrow(
				InvalidBookListCursorException,
			);
			expect(bookRepository.findWithFiltersAfter).not.toHaveBeenCalled();
		});

		describe('on the search path', () => {
			const searchHits = (count: number) =>
				Array.from({ length: count }, (_, index) => ({
					id: `hit-${index}`,
				}));

			it('should page the search engine by offset, fetching one extra hit to know whether more exist', async () => {
				// Arrange
				meiliClient
					.index()
					.search.mockResolvedValue({ hits: searchHits(6) });
				const options = cursorOptions({
					search: 'Solo',
					cursor: encodeSearchCursor(soloSearch, 10),
				});

				// Act
				const result = (await service.getAllBooks(
					options,
					0,
					'user-1',
					[],
				)) as CursorPageDto<{ id: string }>;

				// Assert
				expect(meiliClient.index().search).toHaveBeenCalledWith(
					'Solo',
					expect.objectContaining({ limit: 6, offset: 10 }),
				);
				expect(
					bookRepository.findByIdsPreservingOrder,
				).toHaveBeenCalledWith([
					'hit-0',
					'hit-1',
					'hit-2',
					'hit-3',
					'hit-4',
				]);
				expect(result.hasNextPage).toBe(true);
				expect(result.nextCursor).toBe(
					encodeSearchCursor(soloSearch, 15),
				);
			});

			it('should end the search walk when the engine has no more hits', async () => {
				// Arrange
				meiliClient
					.index()
					.search.mockResolvedValue({ hits: searchHits(3) });

				// Act
				const result = (await service.getAllBooks(
					cursorOptions({ search: 'Solo' }),
					0,
					'user-1',
					[],
				)) as CursorPageDto<{ id: string }>;

				// Assert
				expect(meiliClient.index().search).toHaveBeenCalledWith(
					'Solo',
					expect.objectContaining({ offset: 0 }),
				);
				expect(result.hasNextPage).toBe(false);
				expect(result.nextCursor).toBeNull();
			});

			it('should restart at the first MySQL keyset page when the search engine fails, since a search offset means nothing there', async () => {
				// Arrange
				meiliClient
					.index()
					.search.mockRejectedValue(new Error('Meili Down'));
				const options = cursorOptions({
					search: 'Solo',
					cursor: encodeSearchCursor(soloSearch, 10),
				});

				// Act
				await service.getAllBooks(options, 0, 'user-1', []);

				// Assert
				expect(
					bookRepository.findWithFiltersAfter,
				).toHaveBeenCalledWith(
					expect.anything(),
					expect.anything(),
					[],
					null,
					6,
				);
			});

			it('should continue a fallback walk on MySQL when a search request brings a keyset cursor', async () => {
				// Arrange
				const options = cursorOptions({
					search: 'Solo',
					cursor: encodeKeysetCursor(soloSearch, positionOf(2)),
				});

				// Act
				await service.getAllBooks(options, 0, 'user-1', []);

				// Assert
				expect(meiliClient.index().search).not.toHaveBeenCalled();
				expect(
					bookRepository.findWithFiltersAfter,
				).toHaveBeenCalledWith(
					expect.anything(),
					expect.anything(),
					[],
					positionOf(2),
					6,
				);
			});
		});
	});

	describe('getStuckEntities', () => {
		it('should return stuck chapters and covers', async () => {
			chapterRepository.findStuckChapters.mockResolvedValue([
				{ id: 'chapter-1' },
			]);
			coverRepository.findStuckCovers.mockResolvedValue([
				{ id: 'cover-1' },
			]);

			const result = await service.getStuckEntities(24);

			expect(result.chapters).toEqual([{ id: 'chapter-1' }]);
			expect(result.covers).toEqual([{ id: 'cover-1' }]);
			expect(chapterRepository.findStuckChapters).toHaveBeenCalledWith(
				24,
			);
			expect(coverRepository.findStuckCovers).toHaveBeenCalledWith(24);
		});
	});

	describe('getBooksWithCoverIssues', () => {
		it('should return books with missing or failed covers', async () => {
			bookRepository.findBooksWithCoverIssues.mockResolvedValue([
				[{ id: 'book-1', originalLanguageCode: 'ko' }],
				1,
			]);

			const result = await service.getBooksWithCoverIssues(1, 10);

			expect(result.data[0].id).toBe('book-1');
			expect(result.metadata.total).toBe(1);
			expect(
				bookRepository.findBooksWithCoverIssues,
			).toHaveBeenCalledWith(1, 10);
		});
	});
});
