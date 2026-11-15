import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Meilisearch } from 'meilisearch';
import { BookType } from 'src/books/domain/enums/book-type.enum';
import { Book } from 'src/books/infrastructure/database/entities/book.entity';
import { Tag } from 'src/books/infrastructure/database/entities/tags.entity';
import { MEILI_CLIENT } from 'src/infrastructure/meilisearch/meilisearch.constants';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { createE2EApp } from './helpers/e2e-app.helper';

jest.setTimeout(180000);

// The app's infinite scroll walks GET /books with nextCursor: every book must
// come exactly once, in the offset order, including ties and NULLs.
describe('Books list cursor pagination (e2e)', () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let meiliClient: Meilisearch;
	// Letters only, so the search engine reads it as one rare word.
	const token = `cursor${randomBytes(6).toString('hex').replace(/\d/g, 'x')}`;
	const tagId = uuidv7();
	const titles = ['Alpha', 'Alpha', 'Alpha', 'Beta', 'Beta', 'Gamma'];
	const publications = [null, 2001, 1999, null, 2001, 1999];
	// Pairs share a timestamp, and some differ only in microseconds.
	const timestamps = [
		'2026-01-01 10:00:00.000001',
		'2026-01-01 10:00:00.000001',
		'2026-01-01 10:00:00.000002',
		'2026-01-01 10:00:00.000002',
		'2026-01-01 09:00:00.000000',
		'2026-01-01 09:00:00.000000',
	];
	const seededIds: string[] = [];

	type ListPage = {
		data: Array<{ id: string; tags: Array<{ id: string }> }>;
		nextCursor: string | null;
		hasNextPage: boolean;
	};

	// The 'short' (3/1s), 'medium' (20/10s) and 'long' (100/60s) throttles
	// count every request of this app; spacing them keeps a walk under all.
	let lastRequestAt = 0;
	const pace = async () => {
		const wait = lastRequestAt + 650 - Date.now();
		if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
		lastRequestAt = Date.now();
	};
	const getBooks = async (query: Record<string, string>) => {
		await pace();
		const search = new URLSearchParams(query).toString();
		return request(app.getHttpServer()).get(`/api/books?${search}`);
	};
	const postGraphql = async (body: object) => {
		await pace();
		return request(app.getHttpServer()).post('/api/graphql').send(body);
	};

	const cursorMode = (cursor: string | null) =>
		JSON.parse(Buffer.from(cursor ?? '', 'base64url').toString('utf8'))
			.mode;

	const walk = async (query: Record<string, string>) => {
		const pages: ListPage[] = [];
		let cursor: string | null = null;
		do {
			const response = await getBooks({
				...query,
				limit: '5',
				paginationMode: 'cursor',
				...(cursor ? { cursor } : {}),
			});
			expect(response.status).toBe(200);
			const page = response.body as ListPage;
			expect(page.data.length).toBeLessThanOrEqual(5);
			expect(page.hasNextPage).toBe(page.nextCursor !== null);
			pages.push(page);
			cursor = page.nextCursor;
		} while (cursor && pages.length < 20);
		return pages;
	};
	const idsOf = (pages: ListPage[]) =>
		pages.flatMap((page) => page.data.map((book) => book.id));

	beforeAll(async () => {
		app = await createE2EApp();
		dataSource = app.get(DataSource);
		meiliClient = app.get(MEILI_CLIENT);

		const tag = await dataSource
			.getRepository(Tag)
			.save({ id: tagId, name: `e2e-cursor-tag-${token}` });
		// Two copies of each title/year/timestamp shape: 12 books, so a
		// limit of 5 walks three pages.
		for (let copy = 0; copy < 2; copy++) {
			for (const [index, title] of titles.entries()) {
				const id = uuidv7();
				seededIds.push(id);
				await dataSource.getRepository(Book).save({
					id,
					title: `E2E ${title} ${token} ${copy}`,
					publication: publications[index] ?? undefined,
					tags: [tag],
				});
				// updatedAt gets the same ties, or its walk would never reach
				// the tiebreakers.
				await dataSource.query(
					'UPDATE books SET createdAt = ?, updatedAt = ? WHERE id = ?',
					[timestamps[index], timestamps[index], id],
				);
			}
		}
		// Exact title ties; keep updatedAt, which updates itself on write.
		await dataSource.query(
			'UPDATE books SET title = ?, updatedAt = updatedAt WHERE id IN (?)',
			[`E2E Tie ${token}`, seededIds.slice(0, 4)],
		);

		// Indexing runs in the meilisync service, which the e2e stack does not
		// run, so the test indexes the seeded books itself to exercise the
		// search path. With meilisync running (dev stack) it may rewrite these
		// documents mid-walk and shift the search order between pages.
		await meiliClient
			.index('books')
			.addDocuments(
				seededIds.map((id, index) => ({
					id,
					title: `E2E ${token} ${index}`,
					// The default type filter matches every BookType.
					type: BookType.BOOK,
					maxSensitiveWeight: 0,
					createdAt: index,
				})),
			)
			.waitTask();
	});

	afterAll(async () => {
		// Each step runs even if another fails, so a search engine error
		// never leaves tagged books in the shared database or the app open.
		try {
			await Promise.allSettled([
				meiliClient
					?.index('books')
					.deleteDocuments(seededIds)
					.waitTask(),
				seededIds.length
					? dataSource?.getRepository(Book).delete(seededIds)
					: undefined,
			]);
			await dataSource?.getRepository(Tag).delete(tagId);
		} finally {
			await app?.close();
		}
	});

	it.each([
		[{ orderBy: 'createdAt', order: 'DESC' }],
		[{ orderBy: 'createdAt', order: 'ASC' }],
		[{ orderBy: 'updatedAt', order: 'DESC' }],
		[{ orderBy: 'title', order: 'ASC' }],
		[{ orderBy: 'title', order: 'DESC' }],
		[{ orderBy: 'publication', order: 'ASC' }],
		[{ orderBy: 'publication', order: 'DESC' }],
	])(
		'should walk every book exactly once in the offset order for %o',
		async (sort) => {
			const walked = idsOf(await walk({ tags: tagId, ...sort }));
			const offset = await getBooks({
				tags: tagId,
				...sort,
				limit: '100',
			});

			expect(offset.status).toBe(200);
			expect(new Set(walked).size).toBe(walked.length);
			expect([...walked].sort()).toEqual([...seededIds].sort());
			expect(walked).toEqual(
				offset.body.data.map((book: { id: string }) => book.id),
			);
		},
	);

	it('should walk search results through the search engine, each book once', async () => {
		const pages = await walk({ search: token });

		const walked = idsOf(pages);
		expect(pages.length).toBe(3);
		expect(pages[0].nextCursor).not.toBeNull();
		expect(cursorMode(pages[0].nextCursor)).toBe('search');
		expect(new Set(walked).size).toBe(walked.length);
		expect([...walked].sort()).toEqual([...seededIds].sort());
	});

	it('should return the classification on cursor pages, without offset metadata', async () => {
		const response = await getBooks({
			tags: tagId,
			paginationMode: 'cursor',
			limit: '5',
		});

		expect(response.status).toBe(200);
		expect(response.body.data[0].tags).toEqual([
			expect.objectContaining({ id: tagId }),
		]);
		expect(response.body).not.toHaveProperty('metadata');
		expect(response.body).not.toHaveProperty('total');
	});

	describe('cursors that cannot continue the request', () => {
		let browseCursor: string;

		beforeAll(async () => {
			const first = await getBooks({
				tags: tagId,
				paginationMode: 'cursor',
				limit: '5',
			});
			browseCursor = first.body.nextCursor;
		});

		it('should answer 400 to a malformed cursor', async () => {
			const response = await getBooks({
				tags: tagId,
				cursor: 'not-a-cursor',
			});

			expect(response.status).toBe(400);
		});

		it('should answer 400 to a tampered timestamp instead of letting MySQL fail on it', async () => {
			const payload = JSON.parse(
				Buffer.from(browseCursor, 'base64url').toString('utf8'),
			);
			const tampered = Buffer.from(
				JSON.stringify({
					...payload,
					value: '2026-13-45 10:00:00.000000',
					createdAt: '2026-13-45 10:00:00.000000',
				}),
			).toString('base64url');

			const response = await getBooks({ tags: tagId, cursor: tampered });

			expect(response.status).toBe(400);
		});

		it('should answer 400 to a cursor issued for another sort', async () => {
			const response = await getBooks({
				tags: tagId,
				cursor: browseCursor,
				orderBy: 'title',
				order: 'ASC',
			});

			expect(response.status).toBe(400);
		});

		it('should answer 400 to a browse cursor reused on a search', async () => {
			const response = await getBooks({
				tags: tagId,
				cursor: browseCursor,
				search: token,
			});

			expect(response.status).toBe(400);
		});
	});

	describe('GraphQL books query', () => {
		const query = `
			query Books($filter: BookFilterInput) {
				books(filter: $filter) { data { id } nextCursor hasNextPage total }
			}
		`;

		it('should page with the same cursor contract', async () => {
			const filter = {
				tags: [tagId],
				limit: 5,
				paginationMode: 'CURSOR',
			};

			const first = await postGraphql({ query, variables: { filter } });
			expect(first.body.errors).toBeUndefined();
			const second = await postGraphql({
				query,
				variables: {
					filter: {
						...filter,
						cursor: first.body.data.books.nextCursor,
					},
				},
			});

			const firstPage = first.body.data.books;
			const secondPage = second.body.data.books;
			expect(firstPage.hasNextPage).toBe(true);
			expect(firstPage.total).toBeNull();
			expect(secondPage.data.length).toBeGreaterThan(0);
			const firstIds = firstPage.data.map(
				(book: { id: string }) => book.id,
			);
			for (const book of secondPage.data) {
				expect(firstIds).not.toContain(book.id);
			}
		});

		it('should report a malformed cursor as a bad request, not a server error', async () => {
			const response = await postGraphql({
				query,
				variables: { filter: { cursor: 'not-a-cursor' } },
			});

			expect(response.body.errors[0].message).toContain('Invalid cursor');
			expect(response.body.errors[0].extensions.code).toBe('BAD_REQUEST');
		});
	});
});
