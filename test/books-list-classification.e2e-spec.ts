import { INestApplication } from '@nestjs/common';
import { Meilisearch } from 'meilisearch';
import { BookType } from 'src/books/domain/enums/book-type.enum';
import { Author } from 'src/books/infrastructure/database/entities/author.entity';
import { Book } from 'src/books/infrastructure/database/entities/book.entity';
import { SensitiveContent } from 'src/books/infrastructure/database/entities/sensitive-content.entity';
import { Tag } from 'src/books/infrastructure/database/entities/tags.entity';
import { MEILI_CLIENT } from 'src/infrastructure/meilisearch/meilisearch.constants';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { createE2EApp } from './helpers/e2e-app.helper';

jest.setTimeout(120000);

// Clients (the app's offline mode) filter cached list items locally, so every
// GET /books item must carry its classification, [] when it has none.
describe('Books list classification (e2e)', () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let meiliClient: Meilisearch;
	const suffix = uuidv7().substring(0, 8);
	const seeded = {
		bookId: uuidv7(),
		title: `E2E Classified Book ${suffix}`,
		tag: { id: uuidv7(), name: `e2e-tag-${suffix}` },
		author: { id: uuidv7(), name: `e2e-author-${suffix}` },
		sensitiveContent: {
			id: uuidv7(),
			name: `e2e-sc-${suffix}`,
			weight: 0,
		},
	};

	beforeAll(async () => {
		app = await createE2EApp();
		dataSource = app.get(DataSource);
		meiliClient = app.get(MEILI_CLIENT);

		// Spread copies: save() writes generated columns back into its argument.
		const tag = await dataSource.getRepository(Tag).save({ ...seeded.tag });
		const author = await dataSource
			.getRepository(Author)
			.save({ ...seeded.author });
		const sensitiveContent = await dataSource
			.getRepository(SensitiveContent)
			.save({ ...seeded.sensitiveContent });
		await dataSource.getRepository(Book).save({
			id: seeded.bookId,
			title: seeded.title,
			tags: [tag],
			authors: [author],
			sensitiveContent: [sensitiveContent],
		});
		// Production indexing runs in an external sync service, so the test
		// indexes the seeded book itself to exercise the search path.
		await meiliClient
			.index('books')
			.addDocuments([
				{
					id: seeded.bookId,
					title: seeded.title,
					// The default type filter matches every BookType.
					type: BookType.BOOK,
					maxSensitiveWeight: 0,
				},
			])
			.waitTask();
	});

	afterAll(async () => {
		if (meiliClient) {
			await meiliClient
				.index('books')
				.deleteDocument(seeded.bookId)
				.waitTask();
		}
		if (dataSource) {
			await dataSource.getRepository(Book).delete(seeded.bookId);
			await dataSource.getRepository(Tag).delete(seeded.tag.id);
			await dataSource.getRepository(Author).delete(seeded.author.id);
			await dataSource
				.getRepository(SensitiveContent)
				.delete(seeded.sensitiveContent.id);
		}
		if (app) {
			await app.close();
		}
	});

	it('should return the tags, authors and sensitiveContent of each database list item', async () => {
		const response = await request(app.getHttpServer())
			.get(`/api/books?tags=${seeded.tag.id}`)
			.expect(200);

		const item = response.body.data.find(
			(book: { id: string }) => book.id === seeded.bookId,
		);
		expect(item).toBeDefined();
		expect(item.tags).toEqual([expect.objectContaining(seeded.tag)]);
		expect(item.authors).toEqual([expect.objectContaining(seeded.author)]);
		expect(item.sensitiveContent).toEqual([
			expect.objectContaining(seeded.sensitiveContent),
		]);
	});

	it('should return the tags, authors and sensitiveContent of each search list item', async () => {
		const response = await request(app.getHttpServer())
			.get(`/api/books?search=${encodeURIComponent(seeded.title)}`)
			.expect(200);

		expect(response.body.data.length).toBeGreaterThan(0);
		const item = response.body.data.find(
			(book: { id: string }) => book.id === seeded.bookId,
		);
		expect(item).toBeDefined();
		expect(item.tags).toEqual([expect.objectContaining(seeded.tag)]);
		expect(item.authors).toEqual([expect.objectContaining(seeded.author)]);
		expect(item.sensitiveContent).toEqual([
			expect.objectContaining(seeded.sensitiveContent),
		]);
	});
});
