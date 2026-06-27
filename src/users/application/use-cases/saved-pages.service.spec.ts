import { UserId } from '@common/domain/value-objects/user-id.vo';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { UserResourcesMapper } from '@users/application/mappers/user-resources.mapper';
import {
	ISavedPagesRepository,
	I_SAVED_PAGES_REPOSITORY,
} from '@users/application/ports/saved-pages-repository.interface';
import { SavedPage } from '@users/domain/entities/saved-page';
import { SavedPagesService } from './saved-pages.service';

describe('SavedPagesService', () => {
	let service: SavedPagesService;
	let savedPagesRepository: jest.Mocked<ISavedPagesRepository>;
	let userResourcesMapper: jest.Mocked<UserResourcesMapper>;

	const mockSavedPagesRepository = {
		save: jest.fn(),
		findOneByPageAndUser: jest.fn(),
		findByIdAndUser: jest.fn(),
		findByUser: jest.fn(),
		findPublicByUser: jest.fn(),
		findPublicByBookAndUser: jest.fn(),
		findByBookAndUser: jest.fn(),
		findByChapterAndUser: jest.fn(),
		countByPageAndUser: jest.fn(),
		countByBookAndUser: jest.fn(),
		softRemove: jest.fn(),
		findForSync: jest.fn(),
		verifyPageOwnership: jest.fn(),
	};

	const mockUserResourcesMapper = {
		toSavedPageList: jest.fn().mockImplementation((val) => val),
		toSavedPage: jest.fn().mockImplementation((val) => val),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SavedPagesService,
				{
					provide: I_SAVED_PAGES_REPOSITORY,
					useValue: mockSavedPagesRepository,
				},
				{
					provide: UserResourcesMapper,
					useValue: mockUserResourcesMapper,
				},
			],
		}).compile();

		service = module.get<SavedPagesService>(SavedPagesService);
		savedPagesRepository = module.get(I_SAVED_PAGES_REPOSITORY);
		userResourcesMapper = module.get(UserResourcesMapper);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('savePage', () => {
		const userIdStr = '00000000-0000-0000-0000-000000000000';
		const dto = {
			pageId: 10,
			chapterId: 'ch-1',
			bookId: 'book-1',
			comment: 'cool page',
		};

		it('should save a page successfully', async () => {
			mockSavedPagesRepository.verifyPageOwnership.mockResolvedValue(
				true,
			);
			mockSavedPagesRepository.findOneByPageAndUser.mockResolvedValue(
				null,
			);

			const newSavedPage = SavedPage.create(
				'',
				UserId.create(userIdStr),
				dto.pageId,
				dto.chapterId,
				dto.bookId,
				dto.comment,
				false,
			);

			mockSavedPagesRepository.save.mockResolvedValue(newSavedPage);

			const result = await service.savePage(dto as any, userIdStr);

			expect(mockSavedPagesRepository.save).toHaveBeenCalled();
			expect(result).toBeDefined();
		});

		it('should throw NotFoundException if page does not exist or ownership mismatch', async () => {
			mockSavedPagesRepository.verifyPageOwnership.mockResolvedValue(
				false,
			);

			await expect(
				service.savePage(dto as any, userIdStr),
			).rejects.toThrow(NotFoundException);
		});

		it('should throw BadRequestException if page is already saved', async () => {
			mockSavedPagesRepository.verifyPageOwnership.mockResolvedValue(
				true,
			);

			const existing = SavedPage.create(
				'',
				UserId.create(userIdStr),
				dto.pageId,
				dto.chapterId,
				dto.bookId,
				null,
				false,
			);
			mockSavedPagesRepository.findOneByPageAndUser.mockResolvedValue(
				existing,
			);

			await expect(
				service.savePage(dto as any, userIdStr),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('getSavedPages', () => {
		it('should return mapped saved pages', async () => {
			const savedPages = [
				SavedPage.create(
					'',
					UserId.create('00000000-0000-0000-0000-000000000000'),
					1,
					'',
					'',
					null,
					false,
				),
			];
			mockSavedPagesRepository.findByUser.mockResolvedValue(savedPages);

			const result = await service.getSavedPages(
				'00000000-0000-0000-0000-000000000000',
			);

			expect(result).toEqual(savedPages);
			expect(
				mockUserResourcesMapper.toSavedPageList,
			).toHaveBeenCalledWith(savedPages);
		});
	});

	describe('updateComment', () => {
		it('should update comment and save', async () => {
			const existing = SavedPage.create(
				's1',
				UserId.create('00000000-0000-0000-0000-000000000000'),
				1,
				'',
				'',
				'old',
				false,
			);
			mockSavedPagesRepository.findByIdAndUser.mockResolvedValue(
				existing,
			);
			mockSavedPagesRepository.save.mockResolvedValue(existing);

			const result = await service.updateComment(
				's1',
				{ comment: 'new' },
				'00000000-0000-0000-0000-000000000000',
			);

			expect(mockSavedPagesRepository.save).toHaveBeenCalled();
		});
	});
});
