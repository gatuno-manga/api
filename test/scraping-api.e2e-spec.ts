import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createAdminAccessToken, createE2EApp } from './helpers/e2e-app.helper';

jest.setTimeout(120000);

interface QueueStatsItem {
	name: string;
	counts: {
		waiting: number;
		active: number;
		completed: number;
		failed: number;
		delayed: number;
	};
	activeJobs?: Array<{ bookId?: string | null }>;
	pendingJobs?: Array<{ bookId?: string | null }>;
}

interface QueueStatsPayload {
	queues: QueueStatsItem[];
}

function extractPayload<T>(body: unknown): T {
	if (
		typeof body === 'object' &&
		body !== null &&
		'data' in (body as Record<string, unknown>) &&
		(body as Record<string, unknown>).data
	) {
		return (body as { data: T }).data;
	}

	return body as T;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Scraping pipeline API (e2e)', () => {
	let app: INestApplication;
	let adminToken: string;

	beforeAll(async () => {
		app = await createE2EApp();
		adminToken = createAdminAccessToken(app);
	});

	afterAll(async () => {
		if (app) {
			await app.close();
		}
	});

	const getQueueStats = async (): Promise<QueueStatsPayload> => {
		const response = await request(app.getHttpServer())
			.get('/api/books/dashboard/queue-stats')
			.set('Authorization', `Bearer ${adminToken}`);

		expect(response.status).toBe(200);
		return extractPayload<QueueStatsPayload>(response.body);
	};

	it('returns scraping-related queue stats for admin', async () => {
		const payload = await getQueueStats();
		const queueNames = payload.queues.map((queue) => queue.name);

		expect(queueNames).toEqual(
			expect.arrayContaining([
				'book-update-queue',
				'chapter-scraping',
				'cover-image-queue',
				'fix-chapter-queue',
			]),
		);
	});

	it('enqueues and processes a real book-update job through API endpoint', async () => {
		const queueStatsBefore = await getQueueStats();
		const bookUpdateQueueBefore = queueStatsBefore.queues.find(
			(queue) => queue.name === 'book-update-queue',
		);
		expect(bookUpdateQueueBefore).toBeDefined();

		const failedBefore = Number(bookUpdateQueueBefore?.counts.failed ?? 0);
		const testBookId = randomUUID();

		const triggerResponse = await request(app.getHttpServer())
			.post(`/api/books/${testBookId}/check-updates`)
			.set('Authorization', `Bearer ${adminToken}`);

		expect([200, 201]).toContain(triggerResponse.status);

		let observedRealQueueTransition = false;

		for (let attempt = 0; attempt < 30; attempt++) {
			const queueStatsNow = await getQueueStats();
			const queueNow = queueStatsNow.queues.find(
				(queue) => queue.name === 'book-update-queue',
			);

			if (!queueNow) {
				await sleep(1500);
				continue;
			}

			const failedNow = Number(queueNow.counts.failed ?? 0);
			const activeJobs = queueNow.activeJobs ?? [];
			const pendingJobs = queueNow.pendingJobs ?? [];
			const inFlightForBook = [...activeJobs, ...pendingJobs].some(
				(job) => job.bookId === testBookId,
			);

			if (inFlightForBook || failedNow > failedBefore) {
				observedRealQueueTransition = true;
				break;
			}

			await sleep(1500);
		}

		expect(observedRealQueueTransition).toBe(true);
	});
});
