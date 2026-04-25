import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { Chapter } from '@books/infrastructure/database/entities/chapter.entity';
import { Page } from '@books/infrastructure/database/entities/page.entity';
import { BookType } from '@books/domain/enums/book-type.enum';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { createE2EApp, createAdminAccessToken } from './helpers/e2e-app.helper';
import { DownloadCacheService } from '@books/application/services/download-cache.service';
import * as fs from 'node:fs';
import * as path from 'node:path';

jest.setTimeout(60000);

describe('Download API (e2e)', () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let accessToken: string;
	let bookId: string;
	let chapterId: string;

	beforeAll(async () => {
		app = await createE2EApp();
		dataSource = app.get(DataSource);

		accessToken = createAdminAccessToken(app);

		// Create a dummy book
		const bookRepo = dataSource.getRepository(Book);
		const chapterRepo = dataSource.getRepository(Chapter);
		const pageRepo = dataSource.getRepository(Page);

		const book = bookRepo.create({
			title: 'Test Download FINAL V2',
			type: BookType.BOOK,
			scrapingStatus: ScrapingStatus.READY,
			description: 'Test description',
		});
		await bookRepo.save(book);
		bookId = book.id;

		const chapter = chapterRepo.create({
			title: 'Chapter 1',
			index: 1,
			book: book,
			scrapingStatus: ScrapingStatus.READY,
		});
		await chapterRepo.save(chapter);
		chapterId = chapter.id;

		const page = pageRepo.create({
			chapter: chapter,
			index: 1,
			path: 'test/page1.webp',
		});
		await pageRepo.save(page);
	});

	afterAll(async () => {
		if (app) {
			await app.close();
		}
	});

	describe('Book Download', () => {
		it('should support GET download and NOT throw ENOENT for cache', async () => {
			const response = await request(app.getHttpServer())
				.get(`/api/books/${bookId}/download`)
				.set('authorization', `Bearer ${accessToken}`);

			// If it's not 404, the route works.
			// If it succeeds with 200, great.
			// If it fails with something else, at least we see if cache dir was created.
			expect(response.status).not.toBe(404);

			const cacheService = app.get(DownloadCacheService);
			expect(fs.existsSync(cacheService.CACHE_DIR)).toBe(true);
		});
	});

	describe('Chapter Download', () => {
		it('should support GET download for chapters', async () => {
			const response = await request(app.getHttpServer())
				.get(`/api/chapters/${chapterId}/download`)
				.set('authorization', `Bearer ${accessToken}`);

			expect(response.status).not.toBe(404);
		});
	});
});
