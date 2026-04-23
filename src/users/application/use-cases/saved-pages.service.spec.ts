import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SavedPagesService } from './saved-pages.service';
import { SavedPage } from '../../infrastructure/database/entities/saved-page.entity';
import { Page } from 'src/books/infrastructure/database/entities/page.entity';
import { Chapter } from 'src/books/infrastructure/database/entities/chapter.entity';
import { Book } from 'src/books/infrastructure/database/entities/book.entity';
import { UserResourcesMapper } from '../mappers/user-resources.mapper';

describe('SavedPagesService', () => {
	let service: SavedPagesService;
	let savedPageRepository: jest.Mocked<Repository<SavedPage>>;
	let pageRepository: jest.Mocked<Repository<Page>>;
	let userResourcesMapper: jest.Mocked<UserResourcesMapper>;

	const mockSavedPageRepository = {
		findOne: jest.fn(),
		find: jest.fn(),
		save: jest.fn(),
		create: jest.fn(),
		count: jest.fn(),
		remove: jest.fn(),
	};

	const mockPageRepository = {
		findOne: jest.fn(),
	};

	const mockChapterRepository = {};
	const mockBookRepository = {};

	const mockUserResourcesMapper = {
		toSavedPageList: jest.fn().mockImplementation((val) => val),
		toSavedPage: jest.fn().mockImplementation((val) => val),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SavedPagesService,
				{
					provide: getRepositoryToken(SavedPage),
					useValue: mockSavedPageRepository,
				},
				{
					provide: getRepositoryToken(Page),
					useValue: mockPageRepository,
				},
				{
					provide: getRepositoryToken(Chapter),
					useValue: mockChapterRepository,
				},
				{
					provide: getRepositoryToken(Book),
					useValue: mockBookRepository,
				},
				{
					provide: UserResourcesMapper,
					useValue: mockUserResourcesMapper,
				},
			],
		}).compile();

		service = module.get<SavedPagesService>(SavedPagesService);
		savedPageRepository = module.get(getRepositoryToken(SavedPage));
		pageRepository = module.get(getRepositoryToken(Page));
		userResourcesMapper = module.get(UserResourcesMapper);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('savePage', () => {
		const userId = 'user-1';
		const dto = {
			pageId: 10,
			chapterId: 'ch-1',
			bookId: 'book-1',
			comment: 'cool page',
		};

		it('should save a page successfully', async () => {
			mockPageRepository.findOne.mockResolvedValue({
				id: 10,
				chapter: { id: 'ch-1', book: { id: 'book-1' } },
			} as any);
			mockSavedPageRepository.findOne.mockResolvedValue(null);
			mockSavedPageRepository.create.mockReturnValue(dto as any);
			mockSavedPageRepository.save.mockResolvedValue({
				id: 's1',
				...dto,
			} as any);

			const result = await service.savePage(dto as any, userId);

			expect(result.id).toBe('s1');
			expect(mockSavedPageRepository.save).toHaveBeenCalled();
		});

		it('should throw NotFoundException if page does not exist', async () => {
			mockPageRepository.findOne.mockResolvedValue(null);

			await expect(service.savePage(dto as any, userId)).rejects.toThrow(
				NotFoundException,
			);
		});

		it('should throw BadRequestException if page belongs to different chapter', async () => {
			mockPageRepository.findOne.mockResolvedValue({
				id: 10,
				chapter: { id: 'different-ch', book: { id: 'book-1' } },
			} as any);

			await expect(service.savePage(dto as any, userId)).rejects.toThrow(
				BadRequestException,
			);
		});

		it('should throw BadRequestException if page is already saved', async () => {
			mockPageRepository.findOne.mockResolvedValue({
				id: 10,
				chapter: { id: 'ch-1', book: { id: 'book-1' } },
			} as any);
			mockSavedPageRepository.findOne.mockResolvedValue({
				id: 'existing',
			} as any);

			await expect(service.savePage(dto as any, userId)).rejects.toThrow(
				BadRequestException,
			);
		});
	});

	describe('getSavedPages', () => {
		it('should return mapped saved pages', async () => {
			const savedPages = [{ id: '1' }];
			mockSavedPageRepository.find.mockResolvedValue(savedPages as any);

			const result = await service.getSavedPages('u1');

			expect(result).toEqual(savedPages);
			expect(
				mockUserResourcesMapper.toSavedPageList,
			).toHaveBeenCalledWith(savedPages);
		});
	});

	describe('updateComment', () => {
		it('should update comment and save', async () => {
			const existing = { id: 's1', comment: 'old' };
			mockSavedPageRepository.findOne.mockResolvedValue(existing as any);
			mockSavedPageRepository.save.mockResolvedValue({
				...existing,
				comment: 'new',
			} as any);

			const result = await service.updateComment(
				's1',
				{ comment: 'new' },
				'u1',
			);

			expect(result.comment).toBe('new');
			expect(mockSavedPageRepository.save).toHaveBeenCalled();
		});
	});
});
