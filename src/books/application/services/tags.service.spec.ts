import { MEILI_CLIENT } from '@/infrastructure/meilisearch/meilisearch.constants';
import { I_BOOK_REPOSITORY } from '@books/application/ports/book-repository.interface';
import { I_TAG_REPOSITORY } from '@books/application/ports/tag-repository.interface';
import { Test, TestingModule } from '@nestjs/testing';
import { Meilisearch } from 'meilisearch';
import { SensitiveContentService } from './sensitive-content.service';
import { TagsService } from './tags.service';

describe('TagsService', () => {
	let service: TagsService;
	let meiliClient: jest.Mocked<Meilisearch>;

	const mockTagRepository = {
		findWithFilters: jest.fn(),
		findById: jest.fn(),
		findByIds: jest.fn(),
		replaceReferences: jest.fn(),
		deleteByIds: jest.fn(),
		save: jest.fn(),
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
			const mockHits = [
				{
					id: '1',
					name: 'Action',
					altNames: [{ name: 'Ação', languageCode: 'pt-BR' }],
				},
			];
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

	describe('mergeTags', () => {
		it('should return the target tag if no valid copy ids are provided', async () => {
			const targetTag = { id: 'tag1', name: 'target', aliases: [] };
			mockTagRepository.findById.mockResolvedValue(targetTag);
			mockTagRepository.findByIds = jest.fn().mockResolvedValue([]);

			const result = await service.mergeTags('tag1', []);

			expect(result).toEqual(targetTag);
			expect(mockTagRepository.findByIds).not.toHaveBeenCalled();
		});

		it('should throw NotFoundException if target tag does not exist', async () => {
			mockTagRepository.findById.mockResolvedValue(null);

			await expect(service.mergeTags('tag1', ['tag2'])).rejects.toThrow(
				'Tag with id tag1 not found',
			);
		});

		it('should merge tags, update references, and delete old tags', async () => {
			const targetTag = {
				id: 'tag1',
				name: 'target',
				aliases: ['old_alias'],
			};
			const copyTag1 = {
				id: 'tag2',
				name: 'copy1',
				aliases: ['copy1_alias'],
			};
			const copyTag2 = { id: 'tag3', name: 'copy2', aliases: null };

			mockTagRepository.findById.mockResolvedValue(targetTag);
			mockTagRepository.findByIds = jest
				.fn()
				.mockResolvedValue([copyTag1, copyTag2]);
			mockTagRepository.replaceReferences = jest
				.fn()
				.mockResolvedValue(undefined);
			mockTagRepository.deleteByIds = jest
				.fn()
				.mockResolvedValue(undefined);
			mockTagRepository.save = jest
				.fn()
				.mockImplementation((t) => Promise.resolve(t));

			const result = await service.mergeTags('tag1', ['tag2', 'tag3']);

			// verify aliases are correctly merged and deduped
			expect(result.aliases).toEqual(
				expect.arrayContaining([
					'old_alias',
					'copy1',
					'copy1_alias',
					'copy2',
				]),
			);
			expect(result.aliases).not.toContain('target');

			expect(mockTagRepository.replaceReferences).toHaveBeenCalledWith(
				['tag2', 'tag3'],
				'tag1',
			);
			expect(mockTagRepository.deleteByIds).toHaveBeenCalledWith([
				'tag2',
				'tag3',
			]);
			expect(mockTagRepository.save).toHaveBeenCalledWith(result);
		});
	});
});
