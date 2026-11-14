import { BadRequestException, INestApplication } from '@nestjs/common';
import { authenticator } from 'otplib';
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

interface MfaChallengePayload {
	mfaRequired: boolean;
	mfaType: string;
	mfaToken: string;
	accessToken?: string;
}

interface CreateLoginApiKeyPayload {
	apiKey: string;
	expiresAt: string;
	singleUse: boolean;
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
	let cachedAdminSession: AuthResultPayload | null = null;

	beforeAll(async () => {
		app = await createE2EApp();
		const authService = app.get(AuthService);
		try {
			await authService.signUp(ADMIN_EMAIL, ADMIN_PASSWORD, true);
		} catch (error) {
			if (!(error instanceof BadRequestException)) {
				throw error;
			}
		}
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
		const email = `e2e-login-${uuidv7()}@example.com`;
		const password = 'StrongP@ssw0rd!';

		const signupResponse = await request(app.getHttpServer())
			.post('/api/auth/signup')
			.send({ email, password });

		expect([200, 201]).toContain(signupResponse.status);

		return { email, password };
	};

	const signInAsAdmin = async (): Promise<AuthResultPayload> => {
		if (cachedAdminSession) {
			return cachedAdminSession;
		}

		const response = await request(app.getHttpServer())
			.post('/api/auth/signin')
			.set('x-client-platform', 'mobile')
			.set('x-device-id', `admin-${uuidv7()}`)
			.set('x-device-name', 'Jest Admin Device')
			.send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

		expect([200, 201]).toContain(response.status);
		cachedAdminSession = extractPayload<AuthResultPayload>(response.body);
		return cachedAdminSession;
	};

	it('returns web login payload without refreshToken in body and sets auth cookies', async () => {
		const { email, password } = await createUser();

		const response = await request(app.getHttpServer())
			.post('/api/auth/signin')
			.set('x-client-platform', 'web')
			.set('x-device-id', `web-${uuidv7()}`)
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
			.set('x-device-id', `mobile-${uuidv7()}`)
			.set('x-device-name', 'Jest Mobile Device')
			.send({ email, password });

		expect([200, 201]).toContain(response.status);

		const payload = extractPayload<AuthResultPayload>(response.body);
		expect(payload.accessToken).toEqual(expect.any(String));
		expect(payload.sessionId).toEqual(expect.any(String));
		expect(payload.refreshToken).toEqual(expect.any(String));
	});

	it('challenges a mobile client with TOTP enabled on an unknown device and completes sign-in via verify-login', async () => {
		const { email, password } = await createUser();
		const signInMobile = (deviceId: string) =>
			request(app.getHttpServer())
				.post('/api/auth/signin')
				.set('x-client-platform', 'mobile')
				.set('x-device-id', deviceId)
				.send({ email, password });

		const firstSignIn = await signInMobile(`mobile-${uuidv7()}`);
		expect([200, 201]).toContain(firstSignIn.status);
		const { accessToken } = extractPayload<AuthResultPayload>(
			firstSignIn.body,
		);

		const setupResponse = await request(app.getHttpServer())
			.post('/api/auth/mfa/totp/setup')
			.set('authorization', `Bearer ${accessToken}`)
			.set('x-client-platform', 'mobile');
		expect([200, 201]).toContain(setupResponse.status);
		const { secret } = extractPayload<{ secret: string }>(
			setupResponse.body,
		);

		const verifySetupResponse = await request(app.getHttpServer())
			.post('/api/auth/mfa/totp/verify-setup')
			.set('authorization', `Bearer ${accessToken}`)
			.set('x-client-platform', 'mobile')
			.send({ code: authenticator.generate(secret) });
		expect([200, 201]).toContain(verifySetupResponse.status);
		const { backupCodes } = extractPayload<{ backupCodes: string[] }>(
			verifySetupResponse.body,
		);

		const challengedSignIn = await signInMobile(`mobile-${uuidv7()}`);
		expect([200, 201]).toContain(challengedSignIn.status);
		const challenge = extractPayload<MfaChallengePayload>(
			challengedSignIn.body,
		);
		expect(challenge.mfaRequired).toBe(true);
		expect(challenge.mfaType).toBe('totp');
		expect(challenge.mfaToken).toEqual(expect.any(String));
		expect(challenge.accessToken).toBeUndefined();

		const verifyLoginResponse = await request(app.getHttpServer())
			.post('/api/auth/mfa/verify-login')
			.set('x-client-platform', 'mobile')
			.send({ mfaToken: challenge.mfaToken, code: backupCodes[0] });
		expect([200, 201]).toContain(verifyLoginResponse.status);
		const session = extractPayload<AuthResultPayload>(
			verifyLoginResponse.body,
		);
		expect(session.accessToken).toEqual(expect.any(String));
		expect(session.sessionId).toEqual(expect.any(String));
		expect(session.refreshToken).toEqual(expect.any(String));
	});

	it('supports single-use API key login and blocks reuse', async () => {
		const adminSession = await signInAsAdmin();
		const createApiKeyResponse = await request(app.getHttpServer())
			.post('/api/auth/api-keys')
			.set('authorization', `Bearer ${adminSession.accessToken}`)
			.set('x-client-platform', 'mobile')
			.send({ expiresIn: '1h', singleUse: true });

		expect([200, 201]).toContain(createApiKeyResponse.status);
		const createdApiKey = extractPayload<CreateLoginApiKeyPayload>(
			createApiKeyResponse.body,
		);
		expect(createdApiKey.apiKey).toEqual(expect.any(String));
		expect(createdApiKey.singleUse).toBe(true);

		const firstLogin = await request(app.getHttpServer())
			.post('/api/auth/signin/api-key')
			.set('x-client-platform', 'mobile')
			.send({ apiKey: createdApiKey.apiKey });

		expect([200, 201]).toContain(firstLogin.status);
		const firstPayload = extractPayload<AuthResultPayload>(firstLogin.body);
		expect(firstPayload.accessToken).toEqual(expect.any(String));
		expect(firstPayload.refreshToken).toEqual(expect.any(String));

		const secondLogin = await request(app.getHttpServer())
			.post('/api/auth/signin/api-key')
			.set('x-client-platform', 'mobile')
			.send({ apiKey: createdApiKey.apiKey });

		expect(secondLogin.status).toBe(401);
	});

	it('supports reusable API key login', async () => {
		const adminSession = await signInAsAdmin();
		const createApiKeyResponse = await request(app.getHttpServer())
			.post('/api/auth/api-keys')
			.set('authorization', `Bearer ${adminSession.accessToken}`)
			.set('x-client-platform', 'mobile')
			.send({ expiresIn: '1h', singleUse: false });

		expect([200, 201]).toContain(createApiKeyResponse.status);
		const createdApiKey = extractPayload<CreateLoginApiKeyPayload>(
			createApiKeyResponse.body,
		);
		expect(createdApiKey.apiKey).toEqual(expect.any(String));
		expect(createdApiKey.singleUse).toBe(false);

		const firstLogin = await request(app.getHttpServer())
			.post('/api/auth/signin/api-key')
			.set('x-client-platform', 'mobile')
			.send({ apiKey: createdApiKey.apiKey });
		const secondLogin = await request(app.getHttpServer())
			.post('/api/auth/signin/api-key')
			.set('x-client-platform', 'mobile')
			.send({ apiKey: createdApiKey.apiKey });

		expect([200, 201]).toContain(firstLogin.status);
		expect([200, 201]).toContain(secondLogin.status);
	});

	it('rejects invalid credentials', async () => {
		const response = await request(app.getHttpServer())
			.post('/api/auth/signin')
			.send({
				email: `no-user-${uuidv7()}@example.com`,
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
