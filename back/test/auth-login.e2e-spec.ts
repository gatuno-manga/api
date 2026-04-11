import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createE2EApp } from './helpers/e2e-app.helper';

jest.setTimeout(120000);

interface AuthResultPayload {
	accessToken: string;
	refreshToken?: string;
	sessionId: string;
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

function hasCookie(
	setCookie: string | string[] | undefined,
	cookieName: string,
): boolean {
	const cookieList = Array.isArray(setCookie)
		? setCookie
		: setCookie
			? [setCookie]
			: [];

	return cookieList.some((cookie) => cookie.startsWith(`${cookieName}=`));
}

describe('Auth login API (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		app = await createE2EApp();
	});

	afterAll(async () => {
		if (app) {
			await app.close();
		}
	});

	const createUser = async (): Promise<{
		email: string;
		password: string;
	}> => {
		const email = `e2e-login-${randomUUID()}@example.com`;
		const password = 'StrongP@ssw0rd!';

		const signupResponse = await request(app.getHttpServer())
			.post('/api/auth/signup')
			.send({ email, password });

		expect([200, 201]).toContain(signupResponse.status);

		return { email, password };
	};

	it('returns web login payload without refreshToken in body and sets auth cookies', async () => {
		const { email, password } = await createUser();

		const response = await request(app.getHttpServer())
			.post('/api/auth/signin')
			.set('x-client-platform', 'web')
			.set('x-device-id', `web-${randomUUID()}`)
			.set('x-device-name', 'Jest Web Device')
			.send({ email, password });

		expect([200, 201]).toContain(response.status);

		const payload = extractPayload<AuthResultPayload>(response.body);
		expect(payload.accessToken).toEqual(expect.any(String));
		expect(payload.sessionId).toEqual(expect.any(String));
		expect(payload.refreshToken).toBeUndefined();

		expect(hasCookie(response.headers['set-cookie'], 'refreshToken')).toBe(
			true,
		);
		expect(hasCookie(response.headers['set-cookie'], 'csrfToken')).toBe(
			true,
		);
	});

	it('returns mobile login payload with refreshToken in body', async () => {
		const { email, password } = await createUser();

		const response = await request(app.getHttpServer())
			.post('/api/auth/signin')
			.set('x-client-platform', 'mobile')
			.set('x-device-id', `mobile-${randomUUID()}`)
			.set('x-device-name', 'Jest Mobile Device')
			.send({ email, password });

		expect([200, 201]).toContain(response.status);

		const payload = extractPayload<AuthResultPayload>(response.body);
		expect(payload.accessToken).toEqual(expect.any(String));
		expect(payload.sessionId).toEqual(expect.any(String));
		expect(payload.refreshToken).toEqual(expect.any(String));
	});

	it('rejects invalid credentials', async () => {
		const response = await request(app.getHttpServer())
			.post('/api/auth/signin')
			.send({
				email: `no-user-${randomUUID()}@example.com`,
				password: 'InvalidP@ssw0rd!',
			});

		expect(response.status).toBe(401);
	});

	it('rejects invalid signin payload with validation error', async () => {
		const response = await request(app.getHttpServer())
			.post('/api/auth/signin')
			.send({
				email: 'not-an-email',
				password: '123',
			});

		expect(response.status).toBe(400);
	});
});
