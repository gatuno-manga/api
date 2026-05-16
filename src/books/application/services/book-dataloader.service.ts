import { Inject, Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import {
	I_CHAPTER_REPOSITORY,
	IChapterRepository,
} from '@books/application/ports/chapter-repository.interface';
import {
	I_COVER_REPOSITORY,
	ICoverRepository,
} from '@books/application/ports/cover-repository.interface';
import {
	I_AUTHOR_REPOSITORY,
	IAuthorRepository,
} from '@books/application/ports/author-repository.interface';
import {
	I_TAG_REPOSITORY,
	ITagRepository,
} from '@books/application/ports/tag-repository.interface';
import { Chapter } from '@books/domain/entities/chapter';
import { Cover } from '@books/domain/entities/cover';
import { Author } from '@books/domain/entities/author';
import { Tag } from '@books/domain/entities/tag';

@Injectable({ scope: Scope.REQUEST })
export class BookDataLoaderService {
	constructor(
		@Inject(I_CHAPTER_REPOSITORY)
		private readonly chapterRepository: IChapterRepository,
		@Inject(I_COVER_REPOSITORY)
		private readonly coverRepository: ICoverRepository,
		@Inject(I_AUTHOR_REPOSITORY)
		private readonly authorRepository: IAuthorRepository,
		@Inject(I_TAG_REPOSITORY)
		private readonly tagRepository: ITagRepository,
	) {}

	/**
	 * DataLoader para buscar capítulos de vários livros em uma única query.
	 */
	public readonly chaptersLoader = new DataLoader<string, Chapter[]>(
		async (bookIds: readonly string[]) => {
			const chapters = await this.chapterRepository.findByBookIds([
				...bookIds,
			]);

			// Mapeia os capítulos para seus respectivos livros
			const chaptersByBookId = bookIds.reduce(
				(acc, bookId) => {
					acc[bookId] = chapters.filter(
						(chapter) => chapter.book.id === bookId,
					);
					return acc;
				},
				{} as Record<string, Chapter[]>,
			);

			return bookIds.map((bookId) => chaptersByBookId[bookId] || []);
		},
	);

	/**
	 * DataLoader para buscar capas de vários livros em uma única query.
	 */
	public readonly coversLoader = new DataLoader<string, Cover[]>(
		async (bookIds: readonly string[]) => {
			const covers = await this.coverRepository.findByBookIds([
				...bookIds,
			]);

			// Mapeia as capas para seus respectivos livros
			const coversByBookId = bookIds.reduce(
				(acc, bookId) => {
					acc[bookId] = covers.filter(
						(cover) => cover.book.id === bookId,
					);
					return acc;
				},
				{} as Record<string, Cover[]>,
			);

			return bookIds.map((bookId) => coversByBookId[bookId] || []);
		},
	);

	/**
	 * DataLoader para buscar autores de vários livros em uma única query.
	 */
	public readonly authorsLoader = new DataLoader<string, Author[]>(
		async (bookIds: readonly string[]) => {
			const authorsWithBookId = await this.authorRepository.findByBookIds(
				[...bookIds],
			);

			const authorsByBookId = bookIds.reduce(
				(acc, bookId) => {
					acc[bookId] = authorsWithBookId.filter(
						(a) => a.bookId === bookId,
					);
					return acc;
				},
				{} as Record<string, Author[]>,
			);

			return bookIds.map((bookId) => authorsByBookId[bookId] || []);
		},
	);

	/**
	 * DataLoader para buscar tags de vários livros em uma única query.
	 */
	public readonly tagsLoader = new DataLoader<string, Tag[]>(
		async (bookIds: readonly string[]) => {
			const tagsWithBookId = await this.tagRepository.findByBookIds([
				...bookIds,
			]);

			const tagsByBookId = bookIds.reduce(
				(acc, bookId) => {
					acc[bookId] = tagsWithBookId.filter(
						(t) => t.bookId === bookId,
					);
					return acc;
				},
				{} as Record<string, Tag[]>,
			);

			return bookIds.map((bookId) => tagsByBookId[bookId] || []);
		},
	);
}
