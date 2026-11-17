import { ContentType } from '@books/domain/enums/content-type.enum';
import { ChapterRead } from '@books/infrastructure/database/entities/chapter-read.entity';
import { Chapter } from '@books/infrastructure/database/entities/chapter.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MediaUrlService } from 'src/common/services/media-url.service';
import { ChapterService } from './chapter.service';

describe('ChapterService', () => {
	let service: ChapterService;
	let chapterRepository: {
		createQueryBuilder: jest.Mock;
		findOne: jest.Mock;
	};
	let chapterReadRepository: Record<string, jest.Mock>;

	const chapter = {
		id: 'chapter-1',
		index: 1,
		languageCode: 'en',
		contentType: ContentType.TEXT,
		book: { id: 'book-1', title: 'Book', totalChapters: 3 },
	};

	const queryBuilder = (one: unknown) => {
		const qb: Record<string, jest.Mock> = {};
		for (const method of [
			'leftJoinAndSelect',
			'where',
			'andWhere',
			'orderBy',
			'select',
		]) {
			qb[method] = jest.fn(() => qb);
		}
		qb.getOne = jest.fn().mockResolvedValue(one);
		qb.getMany = jest.fn().mockResolvedValue([]);
		return qb;
	};

	beforeEach(async () => {
		chapterRepository = {
			createQueryBuilder: jest
				.fn()
				.mockReturnValueOnce(queryBuilder(chapter))
				.mockImplementation(() => queryBuilder(null)),
			findOne: jest.fn(),
		};
		chapterReadRepository = {
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			delete: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ChapterService,
				{
					provide: getRepositoryToken(Chapter),
					useValue: chapterRepository,
				},
				{
					provide: getRepositoryToken(ChapterRead),
					useValue: chapterReadRepository,
				},
				{
					provide: MediaUrlService,
					useValue: { resolveUrl: jest.fn((path: string) => path) },
				},
				{ provide: EventEmitter2, useValue: { emit: jest.fn() } },
			],
		}).compile();

		service = module.get(ChapterService);
	});

	describe('getChapter', () => {
		it('returns the chapter without writing read state', async () => {
			const markSpy = jest.spyOn(service, 'markChapterAsRead');
			const result = await service.getChapter('chapter-1');
			await new Promise(setImmediate);

			expect(result).toMatchObject({
				id: 'chapter-1',
				bookId: 'book-1',
				bookTitle: 'Book',
			});
			expect(markSpy).not.toHaveBeenCalled();
			expect(chapterReadRepository.findOne).not.toHaveBeenCalled();
			expect(chapterReadRepository.create).not.toHaveBeenCalled();
			expect(chapterReadRepository.save).not.toHaveBeenCalled();
		});
	});
});
