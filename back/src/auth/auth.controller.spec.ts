import { Test, type TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppConfigService } from '../app-config/app-config.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { RefreshTokenGuard } from './guard/jwt-refresh.guard';
import { WebauthnService } from './services/webauthn.service';

describe('AuthController', () => {
	let controller: AuthController;
	let authService: AuthService;

	const mockAuthService = {
		signIn: jest.fn(),
		signUp: jest.fn(),
		refreshTokens: jest.fn(),
		logout: jest.fn(),
		logoutAll: jest.fn(),
		verifyMfaAndCompleteSignIn: jest.fn(),
		getMfaStatus: jest.fn(),
		beginTotpSetup: jest.fn(),
		verifyTotpSetup: jest.fn(),
		disableTotp: jest.fn(),
		listActiveSessions: jest.fn(),
		revokeSession: jest.fn(),
		revokeOtherSessions: jest.fn(),
		getAuditHistory: jest.fn(),
		generateTokensForUser: jest.fn(),
		completePasskeySignIn: jest.fn(),
		createLoginApiKeyForAdminSelf: jest.fn(),
		signInWithApiKey: jest.fn(),
	};

	const mockWebauthnService = {
		beginAuthentication: jest.fn(),
		verifyAuthentication: jest.fn(),
		listUserPasskeys: jest.fn(),
		beginRegistration: jest.fn(),
		verifyRegistration: jest.fn(),
		deleteUserPasskey: jest.fn(),
	};

	const mockGuard = {
		canActivate: jest.fn(() => true),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			controllers: [AuthController],
			providers: [
				{
					provide: AuthService,
					useValue: mockAuthService,
				},
				{
					provide: AppConfigService,
					useValue: {
						apiUrl: 'http://localhost:3000',
						refreshTokenTtl: 604800000,
					},
				},
				{
					provide: WebauthnService,
					useValue: mockWebauthnService,
				},
			],
		})
			.overrideGuard(JwtAuthGuard)
			.useValue(mockGuard)
			.overrideGuard(RefreshTokenGuard)
			.useValue(mockGuard)
			.compile();

		controller = module.get<AuthController>(AuthController);
		authService = module.get<AuthService>(AuthService);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	it('should have authService injected', () => {
		expect(authService).toBeDefined();
	});

	const createRequest = (
		headers: Record<string, string> = {},
		cookies: Record<string, string> = {},
	): Request => {
		const normalizedHeaders = Object.fromEntries(
			Object.entries(headers).map(([key, value]) => [
				key.toLowerCase(),
				value,
			]),
		);

		return {
			header: (name: string) =>
				normalizedHeaders[name.toLowerCase()] ?? undefined,
			ip: '127.0.0.1',
			socket: {
				remoteAddress: '127.0.0.1',
			},
			cookies,
		} as unknown as Request;
	};

	const createResponse = (): Response =>
		({
			cookie: jest.fn(),
			clearCookie: jest.fn(),
		}) as unknown as Response;

	describe('signIn', () => {
		it('returns web payload without refreshToken in body and sets cookies', async () => {
			const req = createRequest({
				'x-client-platform': 'web',
				'x-device-id': 'device-web-1',
				'x-device-name': 'Web Device',
				'user-agent': 'Jest',
			});
			const res = createResponse();

			mockAuthService.signIn.mockResolvedValue({
				accessToken: 'access-token',
				refreshToken: 'refresh-token',
				sessionId: 'session-1',
			});

			const result = await controller.signIn(
				{
					email: 'user@example.com',
					password: 'StrongP@ssw0rd!',
				},
				req,
				res,
			);

			expect(mockAuthService.signIn).toHaveBeenCalledWith(
				'user@example.com',
				'StrongP@ssw0rd!',
				expect.objectContaining({
					clientPlatform: 'web',
					deviceId: 'device-web-1',
					deviceLabel: 'Web Device',
					userAgent: 'Jest',
				}),
			);
			expect(result).toEqual({
				accessToken: 'access-token',
				sessionId: 'session-1',
			});
			expect(res.cookie).toHaveBeenCalledWith(
				'refreshToken',
				'refresh-token',
				expect.objectContaining({ httpOnly: true, path: '/api/auth' }),
			);
			expect(res.cookie).toHaveBeenCalledWith(
				'csrfToken',
				expect.any(String),
				expect.objectContaining({ httpOnly: false, path: '/' }),
			);
		});

		it('returns mobile payload with refreshToken in response body', async () => {
			const req = createRequest({
				'x-client-platform': 'mobile',
			});
			const res = createResponse();

			mockAuthService.signIn.mockResolvedValue({
				accessToken: 'access-token',
				refreshToken: 'refresh-token',
				sessionId: 'session-1',
			});

			const result = await controller.signIn(
				{
					email: 'user@example.com',
					password: 'StrongP@ssw0rd!',
				},
				req,
				res,
			);

			expect(result).toEqual({
				accessToken: 'access-token',
				refreshToken: 'refresh-token',
				sessionId: 'session-1',
			});
		});

		it('clears cookies when MFA challenge is returned', async () => {
			const req = createRequest();
			const res = createResponse();

			mockAuthService.signIn.mockResolvedValue({
				mfaRequired: true,
				mfaType: 'totp',
				mfaToken: 'mfa-token',
			});

			const result = await controller.signIn(
				{
					email: 'user@example.com',
					password: 'StrongP@ssw0rd!',
				},
				req,
				res,
			);

			expect(result).toEqual({
				mfaRequired: true,
				mfaType: 'totp',
				mfaToken: 'mfa-token',
			});
			expect(res.clearCookie).toHaveBeenCalledWith(
				'refreshToken',
				expect.objectContaining({ path: '/api/auth' }),
			);
			expect(res.clearCookie).toHaveBeenCalledWith(
				'csrfToken',
				expect.objectContaining({ path: '/' }),
			);
		});

		it('propagates auth service errors', async () => {
			const req = createRequest();
			const res = createResponse();
			const error = new UnauthorizedException('Invalid credentials');

			mockAuthService.signIn.mockRejectedValue(error);

			await expect(
				controller.signIn(
					{
						email: 'user@example.com',
						password: 'wrong-password',
					},
					req,
					res,
				),
			).rejects.toThrow(error);
		});
	});
	describe('createLoginApiKey', () => {
		it('creates login API key for current admin user', async () => {
			const req = createRequest({
				'x-client-platform': 'web',
				'x-device-id': 'admin-device',
				'x-device-name': 'Admin Browser',
			});
			const currentUser = {
				userId: '550e8400-e29b-41d4-a716-446655440000',
				username: 'admin',
				roles: ['admin'],
				maxWeightSensitiveContent: 99,
			};
			const responsePayload = {
				apiKey: 'api-key-id.secret',
				expiresAt: new Date('2030-01-01T00:00:00.000Z'),
				singleUse: true,
			};
			mockAuthService.createLoginApiKeyForAdminSelf.mockResolvedValue(
				responsePayload,
			);

			const result = await controller.createLoginApiKey(
				currentUser,
				{
					expiresIn: '2h',
					singleUse: true,
				},
				req,
			);

			expect(
				mockAuthService.createLoginApiKeyForAdminSelf,
			).toHaveBeenCalledWith(
				currentUser.userId,
				expect.objectContaining({
					expiresIn: '2h',
					singleUse: true,
					context: expect.objectContaining({
						clientPlatform: 'web',
						deviceId: 'admin-device',
						deviceLabel: 'Admin Browser',
					}),
				}),
			);
			expect(result).toEqual(responsePayload);
		});
	});

	describe('signInWithApiKey', () => {
		it('returns web payload without refreshToken in body and sets cookies', async () => {
			const req = createRequest({
				'x-client-platform': 'web',
				'x-device-id': 'web-device',
				'x-device-name': 'Web Device',
			});
			const res = createResponse();

			mockAuthService.signInWithApiKey.mockResolvedValue({
				accessToken: 'access-token',
				refreshToken: 'refresh-token',
				sessionId: 'session-1',
			});

			const result = await controller.signInWithApiKey(
				{
					apiKey: 'api-key-id.secret',
				},
				req,
				res,
			);

			expect(mockAuthService.signInWithApiKey).toHaveBeenCalledWith(
				'api-key-id.secret',
				expect.objectContaining({
					clientPlatform: 'web',
					deviceId: 'web-device',
					deviceLabel: 'Web Device',
				}),
			);
			expect(result).toEqual({
				accessToken: 'access-token',
				sessionId: 'session-1',
			});
			expect(res.cookie).toHaveBeenCalledWith(
				'refreshToken',
				'refresh-token',
				expect.objectContaining({ httpOnly: true, path: '/api/auth' }),
			);
			expect(res.cookie).toHaveBeenCalledWith(
				'csrfToken',
				expect.any(String),
				expect.objectContaining({ httpOnly: false, path: '/' }),
			);
		});

		it('returns mobile payload with refreshToken in body', async () => {
			const req = createRequest({
				'x-client-platform': 'mobile',
			});
			const res = createResponse();

			mockAuthService.signInWithApiKey.mockResolvedValue({
				accessToken: 'access-token',
				refreshToken: 'refresh-token',
				sessionId: 'session-1',
			});

			const result = await controller.signInWithApiKey(
				{
					apiKey: 'api-key-id.secret',
				},
				req,
				res,
			);

			expect(result).toEqual({
				accessToken: 'access-token',
				refreshToken: 'refresh-token',
				sessionId: 'session-1',
			});
		});

		it('propagates auth service errors', async () => {
			const req = createRequest();
			const res = createResponse();
			const error = new UnauthorizedException('Invalid API key');

			mockAuthService.signInWithApiKey.mockRejectedValue(error);

			await expect(
				controller.signInWithApiKey(
					{
						apiKey: 'invalid-api-key',
					},
					req,
					res,
				),
			).rejects.toThrow(error);
		});
	});

	describe('refreshTokens', () => {
		const currentUser = {
			userId: '550e8400-e29b-41d4-a716-446655440000',
			username: 'user',
			roles: ['user'],
			maxWeightSensitiveContent: 5,
		};

		it('throws unauthorized when CSRF header is missing for web', async () => {
			const req = createRequest(
				{
					'x-client-platform': 'web',
				},
				{
					refreshToken: 'refresh-token',
					csrfToken: 'csrf-cookie',
				},
			);
			const res = createResponse();

			await expect(
				controller.refreshTokens(currentUser, req, res),
			).rejects.toThrow(UnauthorizedException);
			expect(mockAuthService.refreshTokens).not.toHaveBeenCalled();
		});

		it('throws unauthorized when CSRF header does not match cookie for web', async () => {
			const req = createRequest(
				{
					'x-client-platform': 'web',
					'x-csrf-token': 'csrf-header',
				},
				{
					refreshToken: 'refresh-token',
					csrfToken: 'csrf-cookie',
				},
			);
			const res = createResponse();

			await expect(
				controller.refreshTokens(currentUser, req, res),
			).rejects.toThrow(UnauthorizedException);
			expect(mockAuthService.refreshTokens).not.toHaveBeenCalled();
		});

		it('refreshes web tokens when CSRF cookie/header match', async () => {
			const req = createRequest(
				{
					'x-client-platform': 'web',
					'x-csrf-token': 'csrf-token',
					'x-device-id': 'device-web-1',
					'x-device-name': 'Web Device',
				},
				{
					refreshToken: 'refresh-token',
					csrfToken: 'csrf-token',
				},
			);
			const res = createResponse();

			mockAuthService.refreshTokens.mockResolvedValue({
				accessToken: 'access-token',
				refreshToken: 'new-refresh-token',
				sessionId: 'session-1',
			});

			const result = await controller.refreshTokens(
				currentUser,
				req,
				res,
			);

			expect(mockAuthService.refreshTokens).toHaveBeenCalledWith(
				currentUser.userId,
				'refresh-token',
				expect.objectContaining({
					clientPlatform: 'web',
					deviceId: 'device-web-1',
					deviceLabel: 'Web Device',
				}),
			);
			expect(result).toEqual({
				accessToken: 'access-token',
				sessionId: 'session-1',
			});
			expect(res.cookie).toHaveBeenCalledWith(
				'refreshToken',
				'new-refresh-token',
				expect.objectContaining({ httpOnly: true, path: '/api/auth' }),
			);
			expect(res.cookie).toHaveBeenCalledWith(
				'csrfToken',
				expect.any(String),
				expect.objectContaining({ httpOnly: false, path: '/' }),
			);
		});

		it('allows mobile refresh without CSRF header', async () => {
			const req = createRequest(
				{
					'x-client-platform': 'mobile',
				},
				{
					refreshToken: 'refresh-token',
				},
			);
			const res = createResponse();

			mockAuthService.refreshTokens.mockResolvedValue({
				accessToken: 'access-token',
				refreshToken: 'new-refresh-token',
				sessionId: 'session-1',
			});

			const result = await controller.refreshTokens(
				currentUser,
				req,
				res,
			);

			expect(result).toEqual({
				accessToken: 'access-token',
				refreshToken: 'new-refresh-token',
				sessionId: 'session-1',
			});
		});
	});
});
