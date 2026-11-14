import { INestApplication } from '@nestjs/common';
import { Author } from 'src/books/infrastructure/database/entities/author.entity';
import { Book } from 'src/books/infrastructure/database/entities/book.entity';
import { SensitiveContent } from 'src/books/infrastructure/database/entities/sensitive-content.entity';
import { Tag } from 'src/books/infrastructure/database/entities/tags.entity';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { createE2EApp } from './helpers/e2e-app.helper';

jest.setTimeout(120000);

describe('Books Filters (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		app = await createE2EApp();
	});

	afterAll(async () => {
		if (app) {
			await app.close();
		}
	});

	describe('GET /books', () => {
		it('should return a list of books with default parameters (200 OK)', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/books')
				.expect(200);

			expect(response.body).toHaveProperty('data');
			expect(response.body).toHaveProperty('meta');
			expect(Array.isArray(response.body.data)).toBeTruthy();
		});

		// Clients (the app's offline mode) filter cached list items locally,
		// so every item must carry its classification, [] when it has none.
		describe('classification on list items', () => {
			let dataSource: DataSource;
			const suffix = uuidv7().substring(0, 8);
			const seeded = {
				bookId: uuidv7(),
				tag: { id: uuidv7(), name: `e2e-tag-${suffix}` },
				author: { id: uuidv7(), name: `e2e-author-${suffix}` },
				sensitiveContent: {
					id: uuidv7(),
					name: `e2e-sc-${suffix}`,
					weight: 0,
				},
			};

			beforeAll(async () => {
				dataSource = app.get(DataSource);
				const tag = await dataSource
					.getRepository(Tag)
					.save(seeded.tag);
				const author = await dataSource
					.getRepository(Author)
					.save(seeded.author);
				const sensitiveContent = await dataSource
					.getRepository(SensitiveContent)
					.save(seeded.sensitiveContent);
				await dataSource.getRepository(Book).save({
					id: seeded.bookId,
					title: `E2E Classified Book ${suffix}`,
					tags: [tag],
					authors: [author],
					sensitiveContent: [sensitiveContent],
				});
			});

			afterAll(async () => {
				await dataSource.getRepository(Book).delete(seeded.bookId);
				await dataSource.getRepository(Tag).delete(seeded.tag.id);
				await dataSource.getRepository(Author).delete(seeded.author.id);
				await dataSource
					.getRepository(SensitiveContent)
					.delete(seeded.sensitiveContent.id);
			});

			it('should return the tags, authors and sensitiveContent of each database list item', async () => {
				const response = await request(app.getHttpServer())
					.get(`/api/books?tags=${seeded.tag.id}`)
					.expect(200);

				const item = response.body.data.find(
					(book: { id: string }) => book.id === seeded.bookId,
				);
				expect(item).toBeDefined();
				expect(item.tags).toEqual([
					expect.objectContaining(seeded.tag),
				]);
				expect(item.authors).toEqual([
					expect.objectContaining(seeded.author),
				]);
				expect(item.sensitiveContent).toEqual([
					expect.objectContaining(seeded.sensitiveContent),
				]);
			});

			// Meilisearch indexes asynchronously and the search path falls back
			// to MySQL, so this checks the response shape of a search request,
			// not which path served it.
			it('should return the classification arrays on every item of a search request', async () => {
				const response = await request(app.getHttpServer())
					.get('/api/books?search=a')
					.expect(200);

				for (const item of response.body.data) {
					expect(Array.isArray(item.tags)).toBe(true);
					expect(Array.isArray(item.authors)).toBe(true);
					expect(Array.isArray(item.sensitiveContent)).toBe(true);
				}
			});
		});

		it('should filter books by type', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/books?type=MANGA')
				.expect(200);

			expect(response.body).toHaveProperty('data');
			if (response.body.data.length > 0) {
				expect(response.body.data[0].type).toBe('MANGA');
			}
		});

		it('should accept search queries including alternative titles logic', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/books?search=SomeAlternativeTranslationText')
				.expect(200);

			expect(response.body).toHaveProperty('data');
		});

		it('should filter books by publication year', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/books?publication=2020&publicationOperator=GTE')
				.expect(200);

			expect(response.body).toHaveProperty('data');
		});

		it('should filter books by specific tags logic', async () => {
			// Usando IDs fictícios (UUIDs) para testar a camada de validação (DTO e Filters)
			const mockTagId = '00000000-0000-0000-0000-000000000001';
			const response = await request(app.getHttpServer())
				.get(`/api/books?tags=${mockTagId}&tagsLogic=AND`)
				.expect(200);

			expect(response.body).toHaveProperty('data');
		});

		it('should combine multiple filters safely (search, tags, types, order)', async () => {
			const query = new URLSearchParams({
				search: 'Naruto',
				type: 'MANGA',
				tagsLogic: 'AND',
				excludeTagsLogic: 'OR',
				orderBy: 'CREATED_AT',
				order: 'DESC',
				limit: '10',
				page: '1',
			});

			const response = await request(app.getHttpServer())
				.get(`/api/books?${query.toString()}`)
				.expect(200);

			expect(response.body).toHaveProperty('data');
			expect(response.body.meta.page).toBe(1);
			expect(response.body.meta.limit).toBe(10);
		});
	});
});
