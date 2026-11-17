import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { createE2EApp } from './helpers/e2e-app.helper';

jest.setTimeout(120000);

// The only e2e file that runs with the AppModule throttlers; every other
// file gets an app without them (see createE2EApp).
describe('Throttler (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		app = await createE2EApp({ throttle: true });
	});

	afterAll(async () => {
		if (app) {
			await app.close();
		}
	});

	it('answers 429 past the global short limit (3 per second)', async () => {
		// Sent together so all four land inside the same one-second window.
		const responses = await Promise.all(
			Array.from({ length: 4 }, () =>
				request(app.getHttpServer()).get('/api/books'),
			),
		);

		const statuses = responses
			.map((response) => response.status)
			.sort((a, b) => a - b);
		expect(statuses).toEqual([
			HttpStatus.OK,
			HttpStatus.OK,
			HttpStatus.OK,
			HttpStatus.TOO_MANY_REQUESTS,
		]);
	});

	it('honours a route @Throttle override (POST /auth/signin, 5 per minute)', async () => {
		const credentials = {
			email: `e2e-throttle-${uuidv7()}@example.com`,
			password: 'WrongP@ssw0rd!',
		};
		const statuses: number[] = [];
		for (let attempt = 0; attempt < 6; attempt++) {
			const response = await request(app.getHttpServer())
				.post('/api/auth/signin')
				.send(credentials);
			statuses.push(response.status);
		}

		expect(statuses.slice(0, 5)).not.toContain(
			HttpStatus.TOO_MANY_REQUESTS,
		);
		expect(statuses[5]).toBe(HttpStatus.TOO_MANY_REQUESTS);
	});
});
