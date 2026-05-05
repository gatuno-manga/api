import { Test, TestingModule } from '@nestjs/testing';
import { AuthorsService } from './authors.service';
import { I_AUTHOR_REPOSITORY } from '@books/application/ports/author-repository.interface';
import { I_BOOK_REPOSITORY } from '@books/application/ports/book-repository.interface';
import { SensitiveContentService } from './sensitive-content.service';
import { MEILI_CLIENT } from '@/infrastructure/meilisearch/meilisearch.constants';
import { Meilisearch } from 'meilisearch';

describe('AuthorsService', () => {
	let service: AuthorsService;
	let meiliClient: jest.Mocked<Meilisearch>;

	const mockAuthorsRepository = {
		findWithFilters: jest.fn(),
		findById: jest.fn(),
	};

	const mockBookRepository = {};

	const mockSensitiveContentService = {
		getAll: jest.fn(),
	};

	beforeEach(async () => {
		meiliClient = {
			index: jest.fn().mockReturnValue({
				search: jest.fn(),
			}),
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthorsService,
				{
					provide: I_AUTHOR_REPOSITORY,
					useValue: mockAuthorsRepository,
				},
				{
					provide: I_BOOK_REPOSITORY,
					useValue: mockBookRepository,
				},
				{
					provide: SensitiveContentService,
					useValue: mockSensitiveContentService,
				},
				{
					provide: MEILI_CLIENT,
					useValue: meiliClient,
				},
			],
		}).compile();

		service = module.get<AuthorsService>(AuthorsService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('search', () => {
		it('should call meilisearch with the query', async () => {
			const query = 'Nong';
			const mockHits = [
				{
					id: '1',
					name: 'Nong Nong',
					createdAt: 1000,
					updatedAt: 2000,
				},
			];
			(
				meiliClient.index('authors').search as jest.Mock
			).mockResolvedValue({
				hits: mockHits,
			});

			const result = await service.search(query);

			expect(meiliClient.index).toHaveBeenCalledWith('authors');
			expect(meiliClient.index('authors').search).toHaveBeenCalledWith(
				query,
				{ limit: 20 },
			);
			expect(result[0].name).toBe('Nong Nong');
			expect(result[0].createdAt).toBeInstanceOf(Date);
		});

		it('should return empty array on error', async () => {
			(
				meiliClient.index('authors').search as jest.Mock
			).mockRejectedValue(new Error('Meili Error'));

			const result = await service.search('query');

			expect(result).toEqual([]);
		});
	});
});
