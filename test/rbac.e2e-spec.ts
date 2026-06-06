import { BadRequestException, INestApplication } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { createE2EApp } from './helpers/e2e-app.helper';

jest.setTimeout(120000);

const ADMIN_EMAIL = `e2e-admin-${uuidv7()}@example.com`;
const ADMIN_PASSWORD = 'AdminP@ssw0rd!';
process.env.USERADMIN_EMAIL = ADMIN_EMAIL;
process.env.USERADMIN_PASSWORD = ADMIN_PASSWORD;

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

describe('RBAC (e2e)', () => {
	let app: INestApplication;
	let adminToken: string;
	let userToken: string;

	beforeAll(async () => {
		app = await createE2EApp();
		const authService = app.get(AuthService);

		// Create admin
		try {
			await authService.signUp(ADMIN_EMAIL, ADMIN_PASSWORD, true);
		} catch (error) {
			if (!(error instanceof BadRequestException)) {
				throw error;
			}
		}

		// Login admin
		const adminResponse = await request(app.getHttpServer())
			.post('/api/auth/signin')
			.set('x-client-platform', 'web')
			.set('x-device-id', `admin-${uuidv7()}`)
			.send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

		adminToken = extractPayload<AuthResultPayload>(
			adminResponse.body,
		).accessToken;

		// Create regular user
		const userEmail = `e2e-user-${uuidv7()}@example.com`;
		const userPassword = 'UserP@ssw0rd!';

		await request(app.getHttpServer())
			.post('/api/auth/signup')
			.send({ email: userEmail, password: userPassword });

		// Login regular user
		const userResponse = await request(app.getHttpServer())
			.post('/api/auth/signin')
			.set('x-client-platform', 'web')
			.set('x-device-id', `user-${uuidv7()}`)
			.send({ email: userEmail, password: userPassword });

		userToken = extractPayload<AuthResultPayload>(
			userResponse.body,
		).accessToken;
	});

	afterAll(async () => {
		if (app) {
			await app.close();
		}
	});

	describe('Access Control', () => {
		it('should deny access to admin routes for regular users (403 Forbidden)', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/admin/roles')
				.set('Authorization', `Bearer ${userToken}`);

			expect(response.status).toBe(403);
		});

		it('should allow access to admin routes for admin users (200 OK)', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/admin/roles')
				.set('Authorization', `Bearer ${adminToken}`);

			expect(response.status).toBe(200);
			expect(response.body).toBeDefined();
		});
	});
});
