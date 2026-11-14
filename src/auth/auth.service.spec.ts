import { AppConfigService } from '@app-config/app-config.service';
import { DataEncryptionProvider } from '@encryption/data-encryption.provider';
import { PasswordEncryption } from '@encryption/password-encryption.provider';
import { PasswordMigrationService } from '@encryption/password-migration.service';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Role } from 'src/users/infrastructure/database/entities/role.entity';
import { User } from 'src/users/infrastructure/database/entities/user.entity';
import type { UserAuthData } from './application/ports/user-repository.port';
import { ApiKeyUseCase } from './application/use-cases/api-key.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { RevokeSessionUseCase } from './application/use-cases/revoke-session.use-case';
import { SignInUseCase } from './application/use-cases/sign-in.use-case';
import { SignOutUseCase } from './application/use-cases/sign-out.use-case';
import { SignUpUseCase } from './application/use-cases/sign-up.use-case';
import { AuthService } from './auth.service';
import { MfaService } from './infrastructure/adapters/mfa.service';
import { SessionAuditService } from './infrastructure/adapters/session-audit.service';
import { SessionManagementService } from './infrastructure/adapters/session-management.service';
import { TokenStoreService } from './infrastructure/adapters/token-store.service';
import { LoginApiKey } from './infrastructure/database/entities/login-api-key.entity';
import type { SuccessfulAuthResult } from './types/auth-security.types';

describe('AuthService', () => {
	let service: AuthService;
	let module: TestingModule;
	let userRepository: any;
	let _roleRepository: any;
	let loginApiKeyRepository: any;
	let jwtService: any;
	let passwordEncryption: any;
	let _passwordMigration: any;
	let dataEncryption: any;
	let _appConfigService: any;
	let tokenStore: any;
	let sessionAudit: any;
	let _sessionManagement: any;
	let _mfaService: any;

	beforeEach(async () => {
		const mockUserRepository = {
			findOne: jest.fn(),
			findOneBy: jest.fn(),
			find: jest.fn(),
			save: jest.fn(),
			create: jest.fn(),
		};

		const mockRoleRepository = {
			findOne: jest.fn(),
			find: jest.fn(),
		};

		const mockLoginApiKeyRepository = {
			findOne: jest.fn(),
			save: jest.fn(),
			create: jest.fn((value) => value),
		};

		const mockJwtService = {
			sign: jest.fn(),
			signAsync: jest.fn(),
			verify: jest.fn(),
			decode: jest.fn(),
		};

		const mockPasswordEncryption = {
			encrypt: jest.fn(),
			compare: jest.fn(),
			getAlgorithm: jest.fn().mockReturnValue('scrypt'),
		};

		const mockPasswordMigration = {
			needsMigration: jest.fn(),
			migratePasswordOnLogin: jest.fn(),
		};

		const mockDataEncryption = {
			encrypt: jest.fn(),
			decrypt: jest.fn(),
			compare: jest.fn(),
		};

		const mockAppConfigService = {
			jwt: {
				accessSecret: 'test-access-secret',
				refreshSecret: 'test-refresh-secret',
				accessExpiration: '15m',
				refreshExpiration: '7d',
				issuer: 'gatuno-auth-test',
				audience: 'gatuno-api-test',
			},
			security: {
				mfaChallengeExpiration: '5m',
				mfaStepUpEnabled: true,
				saltLength: 16,
				passwordKeyLength: 64,
			},
			authApiKeyDefaultExpiration: '1h',
			authApiKeyMaxExpiration: '30d',
			authApiKeyDefaultTtl: 3600000,
			authApiKeyMaxTtl: 2592000000,
			refreshTokenTtl: 604800000,
		};

		const mockTokenStore = {
			getValidTokens: jest.fn(),
			saveTokens: jest.fn(),
			addToken: jest.fn().mockResolvedValue([]),
			removeAllTokens: jest.fn(),
			removeTokenByJti: jest.fn(),
			removeTokensByJtis: jest.fn(),
			revokeTokenFamily: jest.fn(),
			runWithRefreshLock: jest.fn(
				async (_userId: string, operation: () => Promise<unknown>) =>
					operation(),
			),
		};

		const mockSessionAudit = {
			track: jest.fn(),
			listUserAuditHistory: jest.fn(),
		};

		const mockSessionManagement = {
			hasKnownDevice: jest.fn().mockResolvedValue(true),
			createSession: jest.fn(),
			rotateSessionToken: jest.fn(),
			revokeSessionByRefreshTokenJti: jest.fn(),
			revokeSessionById: jest.fn(),
			revokeAllSessions: jest.fn(),
			revokeSessionsByFamily: jest.fn(),
			listActiveSessions: jest.fn(),
		};

		const mockMfaService = {
			isTotpEnabled: jest.fn().mockResolvedValue(false),
			verifyLoginCode: jest.fn().mockResolvedValue(true),
			getStatus: jest.fn(),
			beginTotpSetup: jest.fn(),
			verifyTotpSetup: jest.fn(),
			disableTotp: jest.fn(),
		};

		module = await Test.createTestingModule({
			providers: [
				AuthService,
				{
					provide: getRepositoryToken(User),
					useValue: mockUserRepository,
				},
				{
					provide: getRepositoryToken(Role),
					useValue: mockRoleRepository,
				},
				{
					provide: getRepositoryToken(LoginApiKey),
					useValue: mockLoginApiKeyRepository,
				},
				{
					provide: JwtService,
					useValue: mockJwtService,
				},
				{
					provide: PasswordEncryption,
					useValue: mockPasswordEncryption,
				},
				{
					provide: PasswordMigrationService,
					useValue: mockPasswordMigration,
				},
				{
					provide: DataEncryptionProvider,
					useValue: mockDataEncryption,
				},
				{
					provide: AppConfigService,
					useValue: mockAppConfigService,
				},
				{
					provide: TokenStoreService,
					useValue: mockTokenStore,
				},
				{
					provide: SessionAuditService,
					useValue: mockSessionAudit,
				},
				{
					provide: SessionManagementService,
					useValue: mockSessionManagement,
				},
				{
					provide: MfaService,
					useValue: mockMfaService,
				},
				{
					provide: SignUpUseCase,
					useValue: {
						execute: jest.fn(),
					},
				},
				{
					provide: SignInUseCase,
					useValue: {
						execute: jest.fn(),
					},
				},
				{
					provide: RefreshTokenUseCase,
					useValue: {
						execute: jest.fn(),
					},
				},
				{
					provide: SignOutUseCase,
					useValue: {
						execute: jest.fn(),
						executeAll: jest.fn(),
					},
				},
				{
					provide: RevokeSessionUseCase,
					useValue: {
						execute: jest.fn(),
						executeOther: jest.fn(),
					},
				},
				{
					provide: ApiKeyUseCase,
					useValue: {
						createForAdminSelf: jest.fn(),
						signIn: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<AuthService>(AuthService);
		userRepository = module.get(getRepositoryToken(User));
		_roleRepository = module.get(getRepositoryToken(Role));
		loginApiKeyRepository = module.get(getRepositoryToken(LoginApiKey));
		jwtService = module.get<JwtService>(JwtService);
		passwordEncryption = module.get<PasswordEncryption>(PasswordEncryption);
		_passwordMigration = module.get<PasswordMigrationService>(
			PasswordMigrationService,
		);
		dataEncryption = module.get<DataEncryptionProvider>(
			DataEncryptionProvider,
		);
		_appConfigService = module.get<AppConfigService>(AppConfigService);
		tokenStore = module.get<TokenStoreService>(TokenStoreService);
		sessionAudit = module.get<SessionAuditService>(SessionAuditService);
		_sessionManagement = module.get<SessionManagementService>(
			SessionManagementService,
		);
		_mfaService = module.get<MfaService>(MfaService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('should have logger initialized', () => {
		expect(service.logger).toBeDefined();
	});

	it('should have session audit service injected', () => {
		expect(sessionAudit).toBeDefined();
	});

	describe('getAlgorithm', () => {
		it('should return the active hashing algorithm', () => {
			expect(passwordEncryption.getAlgorithm()).toBe('scrypt');
		});
	});

	describe('signUp', () => {
		it('should create a new user successfully', async () => {
			const email = 'test@example.com';
			const password = 'password123';
			const user = { id: '123', email };

			const signUpUseCase = module.get<SignUpUseCase>(SignUpUseCase);
			jest.spyOn(signUpUseCase, 'execute').mockResolvedValue(user as any);

			const result = await service.signUp(email, password);

			expect(signUpUseCase.execute).toHaveBeenCalledWith(
				email,
				password,
				false,
			);
			expect(result).toEqual(user);
		});

		it('should create admin user when isAdmin is true', async () => {
			const email = 'admin@example.com';
			const password = 'admin123';

			const signUpUseCase = module.get<SignUpUseCase>(SignUpUseCase);
			jest.spyOn(signUpUseCase, 'execute').mockResolvedValue({
				id: '1',
				email,
			} as any);

			await service.signUp(email, password, true);

			expect(signUpUseCase.execute).toHaveBeenCalledWith(
				email,
				password,
				true,
			);
		});
	});

	describe('signIn', () => {
		it('should sign in user successfully', async () => {
			const email = 'test@example.com';
			const password = 'password123';
			const _user = { id: '123', email };
			const tokens = {
				accessToken: 'access_token',
				refreshToken: 'refresh_token',
			};

			const signInUseCase = module.get<SignInUseCase>(SignInUseCase);
			jest.spyOn(signInUseCase, 'execute').mockResolvedValue(
				tokens as any,
			);

			const result = await service.signIn(email, password);

			expect(signInUseCase.execute).toHaveBeenCalledWith(
				email,
				password,
				undefined,
				expect.any(Function),
			);
			expect(result).toEqual(tokens);
		});
	});

	describe('MFA step-up at sign-in', () => {
		const user = { id: 'user-1', email: 'mfa@example.com' };
		const mobileContext = {
			ipAddress: '10.0.0.1',
			userAgent: 'Dart/3.5 (dart:io)',
			clientPlatform: 'mobile',
			deviceId: null,
			deviceLabel: null,
		};
		const tokens: SuccessfulAuthResult = {
			accessToken: 'access_token',
			refreshToken: 'refresh_token',
			sessionId: 'session-1',
		};

		const signInWithPassword = async () => {
			const signInUseCase = module.get<SignInUseCase>(SignInUseCase);
			jest.spyOn(signInUseCase, 'execute').mockImplementation(
				async (_email, _password, context, issueAuthFlow) => {
					if (!issueAuthFlow) {
						throw new Error('sign-in callback was not provided');
					}
					return issueAuthFlow(
						user as UserAuthData,
						'password',
						context,
					);
				},
			);
			return service.signIn(user.email, 'password123', mobileContext);
		};

		beforeEach(() => {
			userRepository.createQueryBuilder = jest.fn().mockReturnValue({
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				addSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			});
			jwtService.signAsync.mockResolvedValue('mfa-challenge-token');
			jest.spyOn(service, 'generateTokensForUser').mockResolvedValue(
				tokens,
			);
			_mfaService.isTotpEnabled.mockResolvedValue(true);
			_sessionManagement.hasKnownDevice.mockResolvedValue(false);
		});

		it('challenges a mobile client signing in from an unknown device, so mobile cannot bypass TOTP', async () => {
			const result = await signInWithPassword();

			expect(result).toEqual({
				mfaRequired: true,
				mfaType: 'totp',
				mfaToken: 'mfa-challenge-token',
			});
			expect(service.generateTokensForUser).not.toHaveBeenCalled();
			expect(jwtService.signAsync).toHaveBeenCalledWith(
				expect.objectContaining({
					sub: user.id,
					purpose: 'mfa-login',
					authMethod: 'password',
					context: expect.objectContaining({
						clientPlatform: 'mobile',
					}),
				}),
				expect.any(Object),
			);
		});

		it('issues tokens to a mobile client on a known device, matching the web risk rule', async () => {
			_sessionManagement.hasKnownDevice.mockResolvedValue(true);

			const result = await signInWithPassword();

			expect(result).toEqual(tokens);
			expect(jwtService.signAsync).not.toHaveBeenCalled();
		});

		it('issues tokens to a mobile client when step-up is disabled by configuration', async () => {
			_appConfigService.security.mfaStepUpEnabled = false;

			const result = await signInWithPassword();

			expect(result).toEqual(tokens);
			expect(jwtService.signAsync).not.toHaveBeenCalled();
		});

		it('challenges a mobile passkey sign-in from an unknown device, since passkeys share the same step-up rule', async () => {
			const result = await service.completePasskeySignIn(
				user as User,
				mobileContext,
			);

			expect(result).toEqual(
				expect.objectContaining({ mfaRequired: true }),
			);
			expect(jwtService.signAsync).toHaveBeenCalledWith(
				expect.objectContaining({ authMethod: 'passkey' }),
				expect.any(Object),
			);
		});
	});

	describe('createLoginApiKeyForAdminSelf', () => {
		it('should delegate to ApiKeyUseCase', async () => {
			const userId = 'admin-id';
			const resultPayload = {
				apiKey: 'api-key.secret',
				expiresAt: new Date(),
				singleUse: true,
			};
			const apiKeyUseCase = module.get<ApiKeyUseCase>(ApiKeyUseCase);
			jest.spyOn(apiKeyUseCase, 'createForAdminSelf').mockResolvedValue(
				resultPayload,
			);

			const result = await service.createLoginApiKeyForAdminSelf(userId, {
				expiresIn: '2h',
				singleUse: true,
			});

			expect(apiKeyUseCase.createForAdminSelf).toHaveBeenCalledWith(
				userId,
				expect.objectContaining({
					expiresIn: '2h',
					singleUse: true,
				}),
			);
			expect(result).toEqual(resultPayload);
		});
	});

	describe('signInWithApiKey', () => {
		it('should delegate to ApiKeyUseCase', async () => {
			const tokens = {
				accessToken: 'access-token',
				refreshToken: 'refresh-token',
				sessionId: 'session-1',
			};
			const apiKeyUseCase = module.get<ApiKeyUseCase>(ApiKeyUseCase);
			jest.spyOn(apiKeyUseCase, 'signIn').mockResolvedValue(
				tokens as any,
			);

			const result = await service.signInWithApiKey('api-key.secret');

			expect(apiKeyUseCase.signIn).toHaveBeenCalledWith(
				'api-key.secret',
				expect.any(Object),
				expect.any(Function),
			);
			expect(result).toEqual(tokens);
		});
	});

	describe('logout', () => {
		it('should delegate to SignOutUseCase', async () => {
			const userId = 'user123';
			const refreshToken = 'refresh_token';
			const signOutUseCase = module.get<SignOutUseCase>(SignOutUseCase);
			jest.spyOn(signOutUseCase, 'execute').mockResolvedValue({
				message: 'Logged out successfully',
			});

			const result = await service.logout(userId, refreshToken);

			expect(signOutUseCase.execute).toHaveBeenCalledWith(
				userId,
				refreshToken,
				expect.any(Object),
			);
			expect(result).toEqual({ message: 'Logged out successfully' });
		});
	});

	describe('logoutAll', () => {
		it('should delegate to SignOutUseCase', async () => {
			const userId = 'user123';
			const signOutUseCase = module.get<SignOutUseCase>(SignOutUseCase);
			jest.spyOn(signOutUseCase, 'executeAll').mockResolvedValue({
				message: 'All sessions logged out successfully',
			});

			const result = await service.logoutAll(userId);

			expect(signOutUseCase.executeAll).toHaveBeenCalledWith(
				userId,
				expect.any(Object),
			);
			expect(result).toEqual({
				message: 'All sessions logged out successfully',
			});
		});
	});

	describe('refreshTokens', () => {
		it('should delegate to RefreshTokenUseCase', async () => {
			const userId = 'user123';
			const oldRefreshToken = 'old_refresh_token';
			const tokens = {
				accessToken: 'new_access',
				refreshToken: 'new_refresh',
				sessionId: 'session-1',
			};
			const refreshTokenUseCase =
				module.get<RefreshTokenUseCase>(RefreshTokenUseCase);
			jest.spyOn(refreshTokenUseCase, 'execute').mockResolvedValue(
				tokens as any,
			);

			const result = await service.refreshTokens(userId, oldRefreshToken);

			expect(refreshTokenUseCase.execute).toHaveBeenCalledWith(
				userId,
				oldRefreshToken,
				expect.any(Object),
				expect.any(Function),
			);
			expect(result).toEqual(tokens);
		});
	});
});
