import { INestApplication } from '@nestjs/common';
import { ContentType } from 'src/books/domain/enums/content-type.enum';
import { Book } from 'src/books/infrastructure/database/entities/book.entity';
import { Chapter } from 'src/books/infrastructure/database/entities/chapter.entity';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { createE2EApp } from './helpers/e2e-app.helper';

jest.setTimeout(180000);

// Fetching a chapter must not mark it read (#163); only the explicit REST
// endpoints and GraphQL mutations do.
describe('Chapter read state (e2e)', () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let token: string;
	let userId: string;
	const bookId = uuidv7();
	// One chapter per scenario, so no test depends on another's state.
	const chapterIds = Array.from({ length: 5 }, () => uuidv7());
	const [restGetId, gqlGetId, restMarkId, gqlMarkId, gqlBatchId] = chapterIds;

	const server = () => app.getHttpServer();
	const auth = (req: request.Test) =>
		req.set('Authorization', `Bearer ${token}`);
	const graphql = (query: string, variables?: object, signedIn = true) => {
		const req = request(server())
			.post('/api/graphql')
			.send({ query, variables });
		return signedIn ? auth(req) : req;
	};

	const isRead = async (chapterId: string) => {
		const rows: unknown[] = await dataSource.query(
			'SELECT id FROM chapters_read WHERE userId = ? AND chapterId = ?',
			[userId, chapterId],
		);
		return rows.length > 0;
	};
	// Reads may go to a replica: wait for a write to become visible.
	const eventuallyRead = async (chapterId: string, expected: boolean) => {
		for (let attempt = 0; attempt < 25; attempt++) {
			if ((await isRead(chapterId)) === expected) return;
			await new Promise((resolve) => setTimeout(resolve, 200));
		}
		expect(await isRead(chapterId)).toBe(expected);
	};
	// The old side effect ran after the response. Marking another chapter
	// and waiting for it to show up lets any such write land first.
	const settle = async () => {
		await auth(request(server()).post(`/api/chapters/${restMarkId}/read`));
		await eventuallyRead(restMarkId, true);
		await auth(
			request(server()).delete(`/api/chapters/${restMarkId}/read`),
		);
		await eventuallyRead(restMarkId, false);
	};

	beforeAll(async () => {
		app = await createE2EApp();
		dataSource = app.get(DataSource);

		const email = `e2e-chapter-read-${uuidv7()}@example.com`;
		const password = 'ReaderP@ssw0rd!';
		await request(server())
			.post('/api/auth/signup')
			.send({ email, password })
			.expect((res) => expect(res.status).toBeLessThan(300));
		const signin = await request(server())
			.post('/api/auth/signin')
			.set('x-client-platform', 'web')
			.set('x-device-id', `reader-${uuidv7()}`)
			.send({ email, password });
		token = (signin.body.data ?? signin.body).accessToken;
		userId = JSON.parse(
			Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
		).sub;

		await dataSource
			.getRepository(Book)
			.save({ id: bookId, title: `E2E chapter read ${bookId}` });
		await dataSource.getRepository(Chapter).save(
			chapterIds.map((id, index) => ({
				id,
				index: index + 1,
				languageCode: 'en',
				contentType: ContentType.TEXT,
				content: 'text',
				book: { id: bookId },
			})),
		);
	});

	afterAll(async () => {
		try {
			// chapters_read rows go with the chapters (ON DELETE CASCADE).
			await dataSource?.getRepository(Chapter).delete(chapterIds);
			await dataSource?.getRepository(Book).delete(bookId);
			// Best effort: other tables may still reference the user.
			if (userId) {
				await dataSource
					?.query('DELETE FROM users WHERE id = ?', [userId])
					.catch(() => undefined);
			}
		} finally {
			await app?.close();
		}
	});

	it('GET /chapters/:id does not mark the chapter read for a signed-in caller', async () => {
		const response = await auth(
			request(server()).get(`/api/chapters/${restGetId}`),
		);

		expect(response.status).toBe(200);
		expect(response.body.id).toBe(restGetId);
		await settle();
		expect(await isRead(restGetId)).toBe(false);
	});

	it('the GraphQL chapter query does not mark the chapter read', async () => {
		const response = await graphql(
			'query ($id: ID!) { chapter(id: $id) { id read } }',
			{ id: gqlGetId },
		);

		expect(response.body.errors).toBeUndefined();
		expect(response.body.data.chapter).toEqual({
			id: gqlGetId,
			read: false,
		});
		await settle();
		expect(await isRead(gqlGetId)).toBe(false);
	});

	it('POST and DELETE /chapters/:id/read mark and unmark the chapter', async () => {
		const marked = await auth(
			request(server()).post(`/api/chapters/${restMarkId}/read`),
		);
		expect(marked.status).toBeLessThan(300);
		await eventuallyRead(restMarkId, true);

		const unmarked = await auth(
			request(server()).delete(`/api/chapters/${restMarkId}/read`),
		);
		expect(unmarked.status).toBeLessThan(300);
		await eventuallyRead(restMarkId, false);
	});

	it('markChapterRead and markChapterUnread set and clear read', async () => {
		const marked = await graphql(
			'mutation ($id: ID!) { markChapterRead(chapterId: $id) { id read } }',
			{ id: gqlMarkId },
		);
		expect(marked.body.errors).toBeUndefined();
		expect(marked.body.data.markChapterRead.id).toBe(gqlMarkId);
		await eventuallyRead(gqlMarkId, true);

		const unmarked = await graphql(
			'mutation ($id: ID!) { markChapterUnread(chapterId: $id) { id } }',
			{ id: gqlMarkId },
		);
		expect(unmarked.body.errors).toBeUndefined();
		await eventuallyRead(gqlMarkId, false);
	});

	it('markChaptersRead reports each id, including a missing one', async () => {
		const missingId = uuidv7();
		const response = await graphql(
			'mutation ($ids: [ID!]!) { markChaptersRead(chapterIds: $ids) { chapterId success error } }',
			{ ids: [gqlBatchId, missingId] },
		);

		expect(response.body.errors).toBeUndefined();
		const results = response.body.data.markChaptersRead;
		expect(results[0]).toEqual({
			chapterId: gqlBatchId,
			success: true,
			error: null,
		});
		expect(results[1]).toMatchObject({
			chapterId: missingId,
			success: false,
		});
		await eventuallyRead(gqlBatchId, true);

		const cleared = await graphql(
			'mutation ($ids: [ID!]!) { markChaptersUnread(chapterIds: $ids) { chapterId success } }',
			{ ids: [gqlBatchId] },
		);
		expect(cleared.body.errors).toBeUndefined();
		await eventuallyRead(gqlBatchId, false);
	});

	it('an anonymous caller gets read: null and cannot mark', async () => {
		const query = await graphql(
			'query ($id: ID!) { chapter(id: $id) { id read } }',
			{ id: gqlGetId },
			false,
		);
		expect(query.body.errors).toBeUndefined();
		expect(query.body.data.chapter.read).toBeNull();

		const mutation = await graphql(
			'mutation ($id: ID!) { markChapterRead(chapterId: $id) { id } }',
			{ id: gqlGetId },
			false,
		);
		expect(mutation.body.errors?.length).toBeGreaterThan(0);
		expect(await isRead(gqlGetId)).toBe(false);
	});
});
