import { Cover as DomainCover } from '@books/domain/entities/cover';
import { Cover as InfrastructureCover } from '@books/infrastructure/database/entities/cover.entity';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeOrmCoverRepositoryAdapter } from './typeorm-cover-repository.adapter';

describe('TypeOrmCoverRepositoryAdapter', () => {
	let adapter: TypeOrmCoverRepositoryAdapter;
	let _repository: jest.Mocked<Repository<InfrastructureCover>>;

	const mockQueryBuilder = {
		leftJoinAndSelect: jest.fn().mockReturnThis(),
		where: jest.fn().mockReturnThis(),
		andWhere: jest.fn().mockReturnThis(),
		getMany: jest.fn(),
	};

	const mockRepository = {
		find: jest.fn(),
		save: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
		create: jest.fn().mockReturnValue({}),
		createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TypeOrmCoverRepositoryAdapter,
				{
					provide: getRepositoryToken(InfrastructureCover),
					useValue: mockRepository,
				},
			],
		}).compile();

		adapter = module.get<TypeOrmCoverRepositoryAdapter>(
			TypeOrmCoverRepositoryAdapter,
		);
		_repository = module.get(getRepositoryToken(InfrastructureCover));
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('findStuckCovers', () => {
		it('should return covers stuck in processing or error', async () => {
			const covers = [
				{ id: '1', title: 'Cover 1' },
			] as InfrastructureCover[];
			mockQueryBuilder.getMany.mockResolvedValue(covers);

			const result = await adapter.findStuckCovers(24);

			expect(result).toEqual(covers);
			expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
				'cover.book',
				'book',
			);
			expect(mockQueryBuilder.where).toHaveBeenCalledWith(
				'cover.scrapingStatus IN (:...statuses)',
				{ statuses: ['process', 'error'] },
			);
			expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
				'cover.updatedAt < DATE_SUB(NOW(), INTERVAL :hours HOUR)',
				{ hours: 24 },
			);
			expect(mockQueryBuilder.getMany).toHaveBeenCalled();
		});
	});
});
