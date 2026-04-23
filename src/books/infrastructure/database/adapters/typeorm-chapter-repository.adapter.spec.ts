import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeOrmChapterRepositoryAdapter } from './typeorm-chapter-repository.adapter';
import { Chapter as InfrastructureChapter } from '@books/infrastructure/database/entities/chapter.entity';
import { Chapter as DomainChapter } from '@books/domain/entities/chapter';

describe('TypeOrmChapterRepositoryAdapter', () => {
	let adapter: TypeOrmChapterRepositoryAdapter;
	let repository: jest.Mocked<Repository<InfrastructureChapter>>;

	const mockQueryBuilder = {
		where: jest.fn().mockReturnThis(),
		andWhere: jest.fn().mockReturnThis(),
		select: jest.fn().mockReturnThis(),
		addSelect: jest.fn().mockReturnThis(),
		orderBy: jest.fn().mockReturnThis(),
		limit: jest.fn().mockReturnThis(),
		getMany: jest.fn(),
		getRawMany: jest.fn(),
		getOne: jest.fn(),
		getRawOne: jest.fn(),
	};

	const mockRepository = {
		findOne: jest.fn(),
		find: jest.fn(),
		save: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
		softDelete: jest.fn(),
		softRemove: jest.fn(),
		exists: jest.fn(),
		count: jest.fn(),
		create: jest.fn(),
		merge: jest.fn(),
		createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TypeOrmChapterRepositoryAdapter,
				{
					provide: getRepositoryToken(InfrastructureChapter),
					useValue: mockRepository,
				},
			],
		}).compile();

		adapter = module.get<TypeOrmChapterRepositoryAdapter>(
			TypeOrmChapterRepositoryAdapter,
		);
		repository = module.get(getRepositoryToken(InfrastructureChapter));
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(adapter).toBeDefined();
	});

	describe('findById', () => {
		it('should return a chapter if found', async () => {
			const infraChapter = {
				id: '1',
				title: 'Chapter 1',
			} as InfrastructureChapter;
			mockRepository.findOne.mockResolvedValue(infraChapter);

			const result = await adapter.findById('1');

			expect(result).toEqual(infraChapter);
			expect(mockRepository.findOne).toHaveBeenCalledWith({
				where: { id: '1' },
				relations: undefined,
			});
		});
	});

	describe('save', () => {
		it('should save and return a chapter', async () => {
			const domainChapter = { title: 'New Chapter' } as DomainChapter;
			mockRepository.save.mockResolvedValue({
				...domainChapter,
				id: '1',
			} as InfrastructureChapter);

			const result = await adapter.save(domainChapter);

			expect(result.id).toBe('1');
			expect(mockRepository.save).toHaveBeenCalledWith(domainChapter);
		});
	});

	describe('findChaptersByBookIdWithCursor', () => {
		it('should return chapters without read status when userId is not provided', async () => {
			const chapters = [
				{ id: '1', index: 1 },
				{ id: '2', index: 2 },
			];
			mockQueryBuilder.getMany.mockResolvedValue(chapters);

			const result = await adapter.findChaptersByBookIdWithCursor(
				'book-1',
				{ limit: 10, order: 'ASC' },
			);

			expect(result).toEqual(chapters);
			expect(mockQueryBuilder.where).toHaveBeenCalledWith(
				'chapter.bookId = :id',
				{ id: 'book-1' },
			);
			expect(mockQueryBuilder.getMany).toHaveBeenCalled();
		});

		it('should include read status when userId is provided', async () => {
			const chaptersRaw = [
				{ chapter_id: '1', readCount: '1' },
				{ chapter_id: '2', readCount: '0' },
			];
			mockQueryBuilder.getRawMany.mockResolvedValue(chaptersRaw);

			const result = await adapter.findChaptersByBookIdWithCursor(
				'book-1',
				{ limit: 10 },
				'user-1',
			);

			expect(result).toEqual(chaptersRaw);
			expect(mockQueryBuilder.addSelect).toHaveBeenCalled();
			expect(mockQueryBuilder.getRawMany).toHaveBeenCalled();
		});

		it('should apply cursor index filter', async () => {
			mockQueryBuilder.getMany.mockResolvedValue([]);

			await adapter.findChaptersByBookIdWithCursor('book-1', {
				cursorIndex: 5,
				order: 'ASC',
			});

			expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
				'chapter.index > :cursorIndex',
				{ cursorIndex: 5 },
			);
		});
	});
});
