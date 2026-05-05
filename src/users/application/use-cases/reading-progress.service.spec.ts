import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { ReadingProgressService } from './reading-progress.service';
import { ReadingProgress } from '../../infrastructure/database/entities/reading-progress.entity';
import { SyncStrategyResolver } from '../strategies/sync-strategy.resolver';
import { UserResourcesMapper } from '../mappers/user-resources.mapper';

describe('ReadingProgressService', () => {
	let service: ReadingProgressService;
	let repository: jest.Mocked<Repository<ReadingProgress>>;
	let eventEmitter: jest.Mocked<EventEmitter2>;
	let userResourcesMapper: jest.Mocked<UserResourcesMapper>;

	const mockRepository = {
		findOne: jest.fn(),
		find: jest.fn(),
		save: jest.fn(),
		create: jest.fn(),
		delete: jest.fn(),
		softDelete: jest.fn(),
	};

	const mockEventEmitter = {
		emit: jest.fn(),
	};

	const mockSyncStrategyResolver = {
		resolve: jest.fn(),
	};

	const mockUserResourcesMapper = {
		toReadingProgressDto: jest.fn(),
		toReadingProgressDtoList: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ReadingProgressService,
				{
					provide: getRepositoryToken(ReadingProgress),
					useValue: mockRepository,
				},
				{
					provide: EventEmitter2,
					useValue: mockEventEmitter,
				},
				{
					provide: SyncStrategyResolver,
					useValue: mockSyncStrategyResolver,
				},
				{
					provide: UserResourcesMapper,
					useValue: mockUserResourcesMapper,
				},
			],
		}).compile();

		service = module.get<ReadingProgressService>(ReadingProgressService);
		repository = module.get(getRepositoryToken(ReadingProgress));
		eventEmitter = module.get(EventEmitter2);
		userResourcesMapper = module.get(UserResourcesMapper);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('saveProgress', () => {
		const userId = 'user-1';
		const dto = {
			chapterId: 'chapter-1',
			bookId: 'book-1',
			pageIndex: 5,
			totalPages: 10,
			completed: false,
		};

		it('should create new progress if none exists', async () => {
			mockRepository.findOne.mockResolvedValue(null);
			mockRepository.create.mockReturnValue(dto as any);
			mockRepository.save.mockResolvedValue({ id: '1', ...dto } as any);
			mockUserResourcesMapper.toReadingProgressDto.mockReturnValue(
				dto as any,
			);

			const result = await service.saveProgress(userId, dto);

			expect(mockRepository.create).toHaveBeenCalled();
			expect(mockRepository.save).toHaveBeenCalled();
			expect(mockEventEmitter.emit).toHaveBeenCalledWith(
				'reading.progress.updated',
				expect.any(Object),
			);
			expect(result).toEqual(dto);
		});

		it('should update existing progress if new pageIndex is higher', async () => {
			const existingProgress = {
				id: '1',
				userId,
				chapterId: 'chapter-1',
				pageIndex: 3,
				completed: false,
			};
			mockRepository.findOne.mockResolvedValue(existingProgress);
			mockRepository.save.mockResolvedValue({
				...existingProgress,
				pageIndex: 5,
			});
			mockUserResourcesMapper.toReadingProgressDto.mockReturnValue({
				...dto,
				pageIndex: 5,
			} as any);

			const result = await service.saveProgress(userId, dto);

			expect(existingProgress.pageIndex).toBe(5);
			expect(mockRepository.save).toHaveBeenCalled();
			expect(result.pageIndex).toBe(5);
		});

		it('should not update progress if new pageIndex is lower', async () => {
			const existingProgress = {
				id: '1',
				userId,
				chapterId: 'chapter-1',
				pageIndex: 10,
				completed: false,
			};
			mockRepository.findOne.mockResolvedValue(existingProgress);
			mockRepository.save.mockResolvedValue(existingProgress);
			mockUserResourcesMapper.toReadingProgressDto.mockReturnValue({
				...dto,
				pageIndex: 10,
			} as any);

			await service.saveProgress(userId, { ...dto, pageIndex: 5 });

			expect(existingProgress.pageIndex).toBe(10);
		});
	});

	describe('getProgress', () => {
		it('should return progress if found', async () => {
			const progress = { chapterId: 'ch1' };
			mockRepository.findOne.mockResolvedValue(progress);
			mockUserResourcesMapper.toReadingProgressDto.mockReturnValue(
				progress as any,
			);

			const result = await service.getProgress('u1', 'ch1');

			expect(result).toEqual(progress);
		});

		it('should return null if not found', async () => {
			mockRepository.findOne.mockResolvedValue(null);
			const result = await service.getProgress('u1', 'ch1');
			expect(result).toBeNull();
		});
	});

	describe('syncProgress', () => {
		const userId = 'user-1';

		it('should perform incremental sync when lastSyncAt is provided and progress is empty', async () => {
			const lastSyncAt = new Date('2025-01-01');
			mockRepository.find.mockResolvedValue([]);
			mockUserResourcesMapper.toReadingProgressDtoList.mockReturnValue(
				[],
			);

			await service.syncProgress(userId, { progress: [], lastSyncAt });

			expect(mockRepository.find).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						userId,
						updatedAt: expect.any(Object),
					}),
					withDeleted: true,
				}),
			);
		});

		it('should include deleted records in sync results', async () => {
			const deletedRecord = {
				id: '1',
				chapterId: 'ch1',
				deletedAt: new Date(),
			};
			mockRepository.find.mockResolvedValue([deletedRecord]);
			mockUserResourcesMapper.toReadingProgressDtoList.mockReturnValue([
				{ chapterId: 'ch1', deleted: true } as any,
			]);

			const result = await service.syncProgress(userId, { progress: [] });

			expect(result.synced[0].deleted).toBe(true);
			expect(mockRepository.find).toHaveBeenCalledWith(
				expect.objectContaining({
					withDeleted: true,
				}),
			);
		});
	});
});
