import { Test, TestingModule } from '@nestjs/testing';
import { TagsService } from './tags.service';
import { I_TAG_REPOSITORY } from '../ports/tag-repository.interface';
import { I_BOOK_REPOSITORY } from '../ports/book-repository.interface';
import { SensitiveContentService } from './sensitive-content.service';
import { MEILI_CLIENT } from '../../../infrastructure/meilisearch/meilisearch.constants';
import { Meilisearch } from 'meilisearch';

describe('TagsService', () => {
	let service: TagsService;
	let meiliClient: jest.Mocked<Meilisearch>;

	const mockTagRepository = {
		findWithFilters: jest.fn(),
		findById: jest.fn(),
	};

	const mockBookRepository = {};

	const mockSensitiveContentService = {};

	beforeEach(async () => {
		meiliClient = {
			index: jest.fn().mockReturnValue({
				search: jest.fn(),
			}),
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TagsService,
				{
					provide: I_TAG_REPOSITORY,
					useValue: mockTagRepository,
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

		service = module.get<TagsService>(TagsService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('search', () => {
		it('should call meilisearch with the query', async () => {
			const query = 'Action';
			const mockHits = [{ id: '1', name: 'Action', altNames: ['Ação'] }];
			(meiliClient.index('tags').search as jest.Mock).mockResolvedValue({
				hits: mockHits,
			});

			const result = await service.search(query);

			expect(meiliClient.index).toHaveBeenCalledWith('tags');
			expect(meiliClient.index('tags').search).toHaveBeenCalledWith(
				query,
				{ limit: 30 },
			);
			expect(result[0].name).toBe('Action');
		});

		it('should return empty array on error', async () => {
			(meiliClient.index('tags').search as jest.Mock).mockRejectedValue(
				new Error('Meili Error'),
			);

			const result = await service.search('query');

			expect(result).toEqual([]);
		});
	});
});
