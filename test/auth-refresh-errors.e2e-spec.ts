import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from 'src/infrastructure/redis/redis.constants';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { createE2EApp } from './helpers/e2e-app.helper';

jest.setTimeout(120000);

/**
 * The refresh error contract: a 401 from POST /auth/refresh means the session
 * is dead; any other status (403 CSRF, 409 refresh in progress) leaves the
 * session usable.
 */
describe('Auth refresh errors (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		app = await createE2EApp();
	});

	afterAll(async () => {
		if (app) {
			await app.close();
		}
	});

	interface MobileSession {
		userId: string;
		refreshToken: string;
	}

	const signInMobile = async (): Promise<MobileSession> => {
		const email = `e2e-refresh-${uuidv7()}@example.com`;
		const password = 'StrongP@ssw0rd!';

		const signup = await request(app.getHttpServer())
			.post('/api/auth/signup')
			.send({ email, password });
		expect([200, 201]).toContain(signup.status);

		const signin = await request(app.getHttpServer())
			.post('/api/auth/signin')
			.set('x-client-platform', 'mobile')
			.send({ email, password });
		expect([200, 201]).toContain(signin.status);

		const body = signin.body as {
			data?: { accessToken: string; refreshToken: string };
			accessToken: string;
			refreshToken: string;
		};
		const payload = body.data ?? body;
		const { sub } = app
			.get(JwtService)
			.decode<{ sub: string }>(payload.accessToken);
		return { userId: sub, refreshToken: payload.refreshToken };
	};

	const refresh = (refreshToken: string | undefined, platform: string) => {
		const call = request(app.getHttpServer())
			.post('/api/auth/refresh')
			.set('x-client-platform', platform);
		return refreshToken
			? call.set('Cookie', `refreshToken=${refreshToken}`)
			: call;
	};

	it('answers 401 REFRESH_TOKEN_MISSING without a refresh cookie', async () => {
		const response = await refresh(undefined, 'mobile');

		expect(response.status).toBe(401);
		expect(response.body).toMatchObject({
			statusCode: 401,
			code: 'REFRESH_TOKEN_MISSING',
		});
	});

	it('answers 401 REFRESH_TOKEN_INVALID for a token that is not a valid JWT', async () => {
		const response = await refresh('not-a-jwt', 'mobile');

		expect(response.status).toBe(401);
		expect(response.body).toMatchObject({
			statusCode: 401,
			code: 'REFRESH_TOKEN_INVALID',
		});
	});

	it('answers 403 CSRF_TOKEN_INVALID for web without the CSRF header and keeps the session alive', async () => {
		const session = await signInMobile();

		const rejected = await refresh(session.refreshToken, 'web');

		expect(rejected.status).toBe(403);
		expect(rejected.body).toMatchObject({
			statusCode: 403,
			message: 'Invalid CSRF token',
			code: 'CSRF_TOKEN_INVALID',
		});

		const retried = await refresh(session.refreshToken, 'mobile');
		expect([200, 201]).toContain(retried.status);
	});

	it('answers 409 REFRESH_IN_PROGRESS with Retry-After while the lock is held and keeps the session alive', async () => {
		const session = await signInMobile();
		const redis = app.get<Redis>(REDIS_CLIENT);
		const lockKey = `refresh-lock:${session.userId}`;

		await redis.set(lockKey, 'held-by-e2e', 'PX', 10_000);
		try {
			const conflict = await refresh(session.refreshToken, 'mobile');

			expect(conflict.status).toBe(409);
			expect(conflict.headers['retry-after']).toBe('1');
			expect(conflict.body).toEqual({
				statusCode: 409,
				error: 'Conflict',
				message: 'Refresh already in progress',
				code: 'REFRESH_IN_PROGRESS',
			});
		} finally {
			await redis.del(lockKey);
		}

		const retried = await refresh(session.refreshToken, 'mobile');
		expect([200, 201]).toContain(retried.status);
	});
});
