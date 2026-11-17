import { I_AUTHOR_REPOSITORY } from '@books/application/ports/author-repository.interface';
import { I_CHAPTER_READ_REPOSITORY } from '@books/application/ports/chapter-read-repository.interface';
import { I_CHAPTER_REPOSITORY } from '@books/application/ports/chapter-repository.interface';
import { I_COVER_REPOSITORY } from '@books/application/ports/cover-repository.interface';
import { I_TAG_REPOSITORY } from '@books/application/ports/tag-repository.interface';
import { Test } from '@nestjs/testing';
import { BookDataLoaderService } from './book-dataloader.service';

describe('BookDataLoaderService', () => {
	let service: BookDataLoaderService;
	let findReadChapterIds: jest.Mock;

	beforeEach(async () => {
		findReadChapterIds = jest.fn();
		const module = await Test.createTestingModule({
			providers: [
				BookDataLoaderService,
				{ provide: I_CHAPTER_REPOSITORY, useValue: {} },
				{ provide: I_COVER_REPOSITORY, useValue: {} },
				{ provide: I_AUTHOR_REPOSITORY, useValue: {} },
				{ provide: I_TAG_REPOSITORY, useValue: {} },
				{
					provide: I_CHAPTER_READ_REPOSITORY,
					useValue: { findReadChapterIds },
				},
			],
		}).compile();

		service = await module.resolve(BookDataLoaderService);
	});

	describe('chapterReadLoader', () => {
		it('batches lookups for one user into a single query', async () => {
			findReadChapterIds.mockResolvedValue(['c2']);
			const loader = service.chapterReadLoader('user-1');

			const result = await Promise.all([
				loader.load('c1'),
				loader.load('c2'),
				loader.load('c3'),
			]);

			expect(result).toEqual([false, true, false]);
			expect(findReadChapterIds).toHaveBeenCalledTimes(1);
			expect(findReadChapterIds).toHaveBeenCalledWith('user-1', [
				'c1',
				'c2',
				'c3',
			]);
		});

		it('keeps one loader per user so users never share answers', async () => {
			findReadChapterIds.mockImplementation((userId: string) =>
				Promise.resolve(userId === 'user-1' ? ['c1'] : []),
			);

			expect(service.chapterReadLoader('user-1')).toBe(
				service.chapterReadLoader('user-1'),
			);
			await expect(
				service.chapterReadLoader('user-1').load('c1'),
			).resolves.toBe(true);
			await expect(
				service.chapterReadLoader('user-2').load('c1'),
			).resolves.toBe(false);
		});
	});
});
