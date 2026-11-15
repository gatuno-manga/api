import { INestApplication } from '@nestjs/common';
import { authenticator } from 'otplib';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { createE2EApp } from './helpers/e2e-app.helper';

jest.setTimeout(120000);

// Kept apart from auth-login.e2e-spec.ts on purpose: each app instance has its
// own in-memory throttler storage, and signin is limited to 5 requests per 60s.

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

describe('Auth MFA login API (e2e)', () => {
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
		const email = `e2e-mfa-${uuidv7()}@example.com`;
		const password = 'StrongP@ssw0rd!';

		const signupResponse = await request(app.getHttpServer())
			.post('/api/auth/signup')
			.send({ email, password });

		expect([200, 201]).toContain(signupResponse.status);

		return { email, password };
	};

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

		// Backup code on purpose: the TOTP code consumed by verify-setup is
		// replay-locked for the current 30s window.
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
});
