import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SavedPage as DomainSavedPage } from '@users/domain/entities/saved-page';
import { SavedPage as OrmSavedPage } from '@users/infrastructure/database/entities/saved-page.entity';
import { Page as OrmPage } from 'src/books/infrastructure/database/entities/page.entity';
import { Repository } from 'typeorm';
import { TypeOrmSavedPagesRepository } from './typeorm-saved-pages.repository';

describe('TypeOrmSavedPagesRepository', () => {
	let repository: TypeOrmSavedPagesRepository;
	let ormRepository: jest.Mocked<Repository<OrmSavedPage>>;
	let pageRepository: jest.Mocked<Repository<OrmPage>>;

	beforeEach(async () => {
		const mockOrmRepository = {
			save: jest.fn(),
			findOne: jest.fn(),
			find: jest.fn(),
			count: jest.fn(),
			softRemove: jest.fn(),
		};

		const mockPageRepository = {
			findOne: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TypeOrmSavedPagesRepository,
				{
					provide: getRepositoryToken(OrmSavedPage),
					useValue: mockOrmRepository,
				},
				{
					provide: getRepositoryToken(OrmPage),
					useValue: mockPageRepository,
				},
			],
		}).compile();

		repository = module.get<TypeOrmSavedPagesRepository>(
			TypeOrmSavedPagesRepository,
		);
		ormRepository = module.get(getRepositoryToken(OrmSavedPage));
		pageRepository = module.get(getRepositoryToken(OrmPage));
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should save a domain entity', async () => {
		const userId = UserId.create('00000000-0000-0000-0000-000000000000');
		const domainSavedPage = DomainSavedPage.create(
			'11111111-1111-1111-1111-111111111111',
			userId,
			1,
			'ch-1',
			'book-1',
			null,
			false,
		);

		const savedOrm = new OrmSavedPage();
		savedOrm.id = '11111111-1111-1111-1111-111111111111';
		savedOrm.user = { id: '00000000-0000-0000-0000-000000000000' } as any;
		ormRepository.save.mockResolvedValue(savedOrm);

		await repository.save(domainSavedPage);
		expect(ormRepository.save).toHaveBeenCalled();
	});

	it('should find one by page and user', async () => {
		const userId = UserId.create('00000000-0000-0000-0000-000000000000');
		const ormPage = new OrmSavedPage();
		ormPage.id = '11111111-1111-1111-1111-111111111111';
		ormPage.user = { id: '00000000-0000-0000-0000-000000000000' } as any;

		ormRepository.findOne.mockResolvedValue(ormPage);

		const result = await repository.findOneByPageAndUser(1, userId);
		expect(result).toBeDefined();
		expect(ormRepository.findOne).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { user: { id: userId.toString() }, page: { id: 1 } },
			}),
		);
	});

	it('should return null if findOneByPageAndUser not found', async () => {
		const userId = UserId.create('00000000-0000-0000-0000-000000000000');
		ormRepository.findOne.mockResolvedValue(null);

		const result = await repository.findOneByPageAndUser(1, userId);
		expect(result).toBeNull();
	});

	it('should verify page ownership correctly', async () => {
		pageRepository.findOne.mockResolvedValue({
			id: 1,
			chapter: { id: 'ch-1', book: { id: 'bk-1' } },
		} as any);

		const isValid = await repository.verifyPageOwnership(1, 'ch-1', 'bk-1');
		expect(isValid).toBe(true);
	});

	it('should throw error if ownership mismatches', async () => {
		pageRepository.findOne.mockResolvedValue({
			id: 1,
			chapter: { id: 'ch-2', book: { id: 'bk-1' } },
		} as any);

		await expect(
			repository.verifyPageOwnership(1, 'ch-1', 'bk-1'),
		).rejects.toThrow('Page does not belong to the specified chapter');
	});

	it('should find for sync with lastSyncAt', async () => {
		const userId = UserId.create('00000000-0000-0000-0000-000000000000');
		const lastSyncAt = new Date();
		const ormPage = new OrmSavedPage();
		ormPage.id = '11111111-1111-1111-1111-111111111111';
		ormPage.user = { id: '00000000-0000-0000-0000-000000000000' } as any;
		ormRepository.find.mockResolvedValue([ormPage]);

		const results = await repository.findForSync(userId, lastSyncAt);
		expect(results.length).toBe(1);
		expect(ormRepository.find).toHaveBeenCalledWith(
			expect.objectContaining({
				withDeleted: true,
			}),
		);
	});
});
