import { MEILI_CLIENT } from '@/infrastructure/meilisearch/meilisearch.constants';
import { I_AUTHOR_REPOSITORY } from '@books/application/ports/author-repository.interface';
import { I_BOOK_REPOSITORY } from '@books/application/ports/book-repository.interface';
import { I_CHAPTER_REPOSITORY } from '@books/application/ports/chapter-repository.interface';
import { I_PAGE_REPOSITORY } from '@books/application/ports/page-repository.interface';
import { I_SENSITIVE_CONTENT_REPOSITORY } from '@books/application/ports/sensitive-content-repository.interface';
import { I_TAG_REPOSITORY } from '@books/application/ports/tag-repository.interface';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { MediaUrlService } from 'src/common/services/media-url.service';
import { UserAccessPolicyService } from 'src/users/application/use-cases/user-access-policy.service';
import { BookPageOptionsDto } from '../dto/book-page-options.dto';
import { BookQueryService } from './book-query.service';
import { SensitiveContentService } from './sensitive-content.service';

describe('BookQueryService (Search Optimization)', () => {
	let service: BookQueryService;
	let meiliClient: any;
	let bookRepository: any;
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
		};

		userAccessPolicyService = {
			evaluateListAccessContext: jest.fn().mockResolvedValue({
				effectiveMaxWeightSensitiveContent: 0,
			}),
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
				{ provide: I_CHAPTER_REPOSITORY, useValue: {} },
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
});
