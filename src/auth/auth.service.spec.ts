import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppConfigService } from '../app-config/app-config.service';
import { DataEncryptionProvider } from '../encryption/data-encryption.provider';
import { PasswordEncryption } from '../encryption/password-encryption.provider';
import { PasswordMigrationService } from '../encryption/password-migration.service';
import { Role } from '../users/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { LoginApiKey } from './entities/login-api-key.entity';
import { MfaService } from './services/mfa.service';
import { SessionAuditService } from './services/session-audit.service';
import { SessionManagementService } from './services/session-management.service';
import { TokenStoreService } from './services/token-store.service';

describe('AuthService', () => {
	let service: AuthService;
	let userRepository: any;
	let roleRepository: any;
	let loginApiKeyRepository: any;
	let jwtService: any;
	let passwordEncryption: any;
	let passwordMigration: any;
	let dataEncryption: any;
	let appConfigService: any;
	let tokenStore: any;
	let sessionAudit: any;
	let sessionManagement: any;
	let mfaService: any;

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
			jwtAccessSecret: 'test-access-secret',
			jwtRefreshSecret: 'test-refresh-secret',
			jwtAccessExpiration: '15m',
			jwtRefreshExpiration: '7d',
			authApiKeyDefaultExpiration: '1h',
			authApiKeyMaxExpiration: '30d',
			authApiKeyDefaultTtl: 3600000,
			authApiKeyMaxTtl: 2592000000,
			jwtIssuer: 'gatuno-auth-test',
			jwtAudience: 'gatuno-api-test',
			mfaChallengeExpiration: '5m',
			mfaStepUpEnabled: true,
			refreshTokenTtl: 604800000,
			saltLength: 16,
			passwordKeyLength: 64,
		};

		const mockTokenStore = {
			getValidTokens: jest.fn(),
			saveTokens: jest.fn(),
			addToken: jest.fn(),
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

		const module: TestingModule = await Test.createTestingModule({
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
			],
		}).compile();

		service = module.get<AuthService>(AuthService);
		userRepository = module.get(getRepositoryToken(User));
		roleRepository = module.get(getRepositoryToken(Role));
		loginApiKeyRepository = module.get(getRepositoryToken(LoginApiKey));
		jwtService = module.get<JwtService>(JwtService);
		passwordEncryption = module.get<PasswordEncryption>(PasswordEncryption);
		passwordMigration = module.get<PasswordMigrationService>(
			PasswordMigrationService,
		);
		dataEncryption = module.get<DataEncryptionProvider>(
			DataEncryptionProvider,
		);
		appConfigService = module.get<AppConfigService>(AppConfigService);
		tokenStore = module.get<TokenStoreService>(TokenStoreService);
		sessionAudit = module.get<SessionAuditService>(SessionAuditService);
		sessionManagement = module.get<SessionManagementService>(
			SessionManagementService,
		);
		mfaService = module.get<MfaService>(MfaService);
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
			const hashedPassword = 'hashed_password';
			const role = { id: '1', name: 'user' };
			const savedUser = {
				id: '123',
				email,
				userName: 'test',
				password: hashedPassword,
			};
			const userWithRoles = { ...savedUser, roles: [role] };

			userRepository.findOneBy.mockResolvedValue(null);
			passwordEncryption.encrypt.mockResolvedValue(hashedPassword);
			roleRepository.findOne.mockResolvedValue(role);
			userRepository.save.mockResolvedValue(savedUser);
			userRepository.findOne.mockResolvedValue(userWithRoles);

			const result = await service.signUp(email, password);

			expect(userRepository.findOneBy).toHaveBeenCalledWith({ email });
			expect(passwordEncryption.encrypt).toHaveBeenCalledWith(password);
			expect(roleRepository.findOne).toHaveBeenCalledWith({
				where: { name: 'user' },
			});
			expect(userRepository.save).toHaveBeenCalled();
			expect(result).toEqual(userWithRoles);
		});

		it('should create admin user when isAdmin is true', async () => {
			const email = 'admin@example.com';
			const password = 'admin123';
			const role = { id: '1', name: 'admin' };

			userRepository.findOneBy.mockResolvedValue(null);
			passwordEncryption.encrypt.mockResolvedValue('hashed');
			roleRepository.findOne.mockResolvedValue(role);
			userRepository.save.mockResolvedValue({ id: '1', email });
			userRepository.findOne.mockResolvedValue({
				id: '1',
				email,
				roles: [role],
			});

			await service.signUp(email, password, true);

			expect(roleRepository.findOne).toHaveBeenCalledWith({
				where: { name: 'admin' },
			});
		});

		it('should throw BadRequestException if user already exists', async () => {
			const email = 'existing@example.com';
			userRepository.findOneBy.mockResolvedValue({ id: '1', email });

			await expect(service.signUp(email, 'password')).rejects.toThrow(
				BadRequestException,
			);
			await expect(service.signUp(email, 'password')).rejects.toThrow(
				'User already exists',
			);
		});

		it('should throw BadRequestException if role not found', async () => {
			userRepository.findOneBy.mockResolvedValue(null);
			passwordEncryption.encrypt.mockResolvedValue('hashed');
			roleRepository.findOne.mockResolvedValue(null);

			await expect(
				service.signUp('test@example.com', 'password'),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('signIn', () => {
		it('should sign in user successfully', async () => {
			const email = 'test@example.com';
			const password = 'password123';
			const user = {
				id: '123',
				email,
				password: 'hashed_password',
				roles: [{ id: '1', name: 'user' }],
			};
			const tokens = {
				accessToken: 'access_token',
				refreshToken: 'refresh_token',
			};

			userRepository.findOne.mockResolvedValue(user);
			passwordEncryption.compare.mockResolvedValue(true);
			passwordMigration.migratePasswordOnLogin.mockResolvedValue(false);
			jwtService.signAsync
				.mockResolvedValueOnce('access_token')
				.mockResolvedValueOnce('refresh_token');
			dataEncryption.encrypt.mockResolvedValue('encrypted_token');
			tokenStore.addToken.mockResolvedValue(undefined);

			const result = await service.signIn(email, password);

			expect(userRepository.findOne).toHaveBeenCalledWith({
				where: { email },
				relations: ['roles'],
				select: ['id', 'email', 'password', 'roles'],
			});
			expect(passwordEncryption.compare).toHaveBeenCalledWith(
				user.password,
				password,
			);
			expect(result).toHaveProperty('accessToken');
			expect(result).toHaveProperty('refreshToken');
			expect(tokenStore.addToken).toHaveBeenCalled();
		});

		it('should throw UnauthorizedException if user not found', async () => {
			userRepository.findOne.mockResolvedValue(null);

			await expect(
				service.signIn('test@example.com', 'password'),
			).rejects.toThrow(UnauthorizedException);
			await expect(
				service.signIn('test@example.com', 'password'),
			).rejects.toThrow('User not exists');
		});

		it('should throw UnauthorizedException if password is invalid', async () => {
			const user = {
				id: '1',
				email: 'test@example.com',
				password: 'hashed',
				roles: [],
			};
			userRepository.findOne.mockResolvedValue(user);
			passwordEncryption.compare.mockResolvedValue(false);

			await expect(
				service.signIn('test@example.com', 'wrong_password'),
			).rejects.toThrow(UnauthorizedException);
			await expect(
				service.signIn('test@example.com', 'wrong_password'),
			).rejects.toThrow('Invalid password');
		});

		it('should migrate password if needed', async () => {
			const user = {
				id: '123',
				email: 'test@example.com',
				password: 'old_hash',
				roles: [{ id: '1', name: 'user' }],
			};

			userRepository.findOne.mockResolvedValue(user);
			passwordEncryption.compare.mockResolvedValue(true);
			passwordMigration.migratePasswordOnLogin.mockResolvedValue(true);
			jwtService.signAsync.mockResolvedValue('token');
			dataEncryption.encrypt.mockResolvedValue('encrypted');

			await service.signIn(user.email, 'password');

			expect(
				passwordMigration.migratePasswordOnLogin,
			).toHaveBeenCalledWith(user, 'password');
		});
	});

	describe('createLoginApiKeyForAdminSelf', () => {
		it('should create API key for current admin user', async () => {
			const userId = 'admin-id';
			const expiresAt = new Date('2030-01-01T00:00:00.000Z');
			userRepository.findOne.mockResolvedValue({
				id: userId,
				email: 'admin@example.com',
				roles: [{ name: 'admin' }],
			});
			dataEncryption.encrypt.mockResolvedValue('hashed-api-key-secret');
			loginApiKeyRepository.save.mockResolvedValue({
				id: 'api-key-id',
				expiresAt,
				singleUse: true,
			});

			const result = await service.createLoginApiKeyForAdminSelf(userId, {
				expiresIn: '2h',
				singleUse: true,
			});

			expect(userRepository.findOne).toHaveBeenCalledWith({
				where: { id: userId },
				relations: ['roles'],
			});
			expect(dataEncryption.encrypt).toHaveBeenCalled();
			expect(loginApiKeyRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					userId,
					singleUse: true,
					createdByUserId: userId,
				}),
			);
			expect(result.singleUse).toBe(true);
			expect(result.expiresAt).toEqual(expiresAt);
			expect(result.apiKey).toMatch(/^api-key-id\.[a-f0-9]+$/);
			expect(sessionAudit.track).toHaveBeenCalledWith(
				expect.objectContaining({
					userId,
					event: 'api_key_created',
					success: true,
				}),
			);
		});

		it('should reject creation when user is not admin', async () => {
			userRepository.findOne.mockResolvedValue({
				id: 'user-id',
				email: 'user@example.com',
				roles: [{ name: 'user' }],
			});

			await expect(
				service.createLoginApiKeyForAdminSelf('user-id'),
			).rejects.toThrow(UnauthorizedException);
			await expect(
				service.createLoginApiKeyForAdminSelf('user-id'),
			).rejects.toThrow('Only admins can create login API keys');
		});
	});

	describe('signInWithApiKey', () => {
		it('should sign in with single-use API key and mark it as used', async () => {
			const apiKeyRecord = {
				id: 'api-key-id',
				userId: 'user-1',
				keyHash: 'stored-hash',
				singleUse: true,
				usedAt: null,
				lastUsedAt: null,
				revokedAt: null,
				expiresAt: new Date(Date.now() + 60_000),
			};
			const user = {
				id: 'user-1',
				email: 'user@example.com',
				roles: [{ id: 'role-1', name: 'user' }],
			};
			loginApiKeyRepository.findOne.mockResolvedValue(apiKeyRecord);
			dataEncryption.compare.mockResolvedValue(true);
			userRepository.findOne.mockResolvedValue(user);
			jwtService.signAsync
				.mockResolvedValueOnce('access-token')
				.mockResolvedValueOnce('refresh-token');
			dataEncryption.encrypt.mockResolvedValue('encrypted-refresh-token');
			tokenStore.addToken.mockResolvedValue(undefined);

			const result = await service.signInWithApiKey(
				'api-key-id.super-secret',
				{
					clientPlatform: 'mobile',
				},
			);

			expect(result).toHaveProperty('accessToken', 'access-token');
			expect(result).toHaveProperty('refreshToken', 'refresh-token');
			expect(loginApiKeyRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 'api-key-id',
					usedAt: expect.any(Date),
					lastUsedAt: expect.any(Date),
				}),
			);
			expect(sessionAudit.track).toHaveBeenCalledWith(
				expect.objectContaining({
					event: 'login_success',
					context: expect.objectContaining({
						authMethod: 'api_key',
					}),
				}),
			);
		});

		it('should keep usedAt null for reusable API key', async () => {
			const apiKeyRecord = {
				id: 'api-key-id',
				userId: 'user-1',
				keyHash: 'stored-hash',
				singleUse: false,
				usedAt: null,
				lastUsedAt: null,
				revokedAt: null,
				expiresAt: new Date(Date.now() + 60_000),
			};
			const user = {
				id: 'user-1',
				email: 'user@example.com',
				roles: [{ id: 'role-1', name: 'user' }],
			};
			loginApiKeyRepository.findOne.mockResolvedValue(apiKeyRecord);
			dataEncryption.compare.mockResolvedValue(true);
			userRepository.findOne.mockResolvedValue(user);
			jwtService.signAsync
				.mockResolvedValueOnce('access-token')
				.mockResolvedValueOnce('refresh-token');
			dataEncryption.encrypt.mockResolvedValue('encrypted-refresh-token');
			tokenStore.addToken.mockResolvedValue(undefined);

			await service.signInWithApiKey('api-key-id.reusable-secret');

			expect(loginApiKeyRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 'api-key-id',
					usedAt: null,
					lastUsedAt: expect.any(Date),
				}),
			);
		});

		it('should reject already used single-use API key', async () => {
			loginApiKeyRepository.findOne.mockResolvedValue({
				id: 'api-key-id',
				userId: 'user-1',
				keyHash: 'stored-hash',
				singleUse: true,
				usedAt: new Date(),
				lastUsedAt: new Date(),
				revokedAt: null,
				expiresAt: new Date(Date.now() + 60_000),
			});
			dataEncryption.compare.mockResolvedValue(true);

			await expect(
				service.signInWithApiKey('api-key-id.reused-secret'),
			).rejects.toThrow('API key already used');
			expect(tokenStore.addToken).not.toHaveBeenCalled();
			expect(sessionAudit.track).toHaveBeenCalledWith(
				expect.objectContaining({
					event: 'login_failed',
					success: false,
					metadata: expect.objectContaining({
						reason: 'api_key_already_used',
					}),
				}),
			);
		});
	});

	describe('logout', () => {
		it('should logout user successfully', async () => {
			const userId = 'user123';
			const refreshToken = 'refresh_token';
			const storedTokens = [
				{
					jti: 'refresh-jti',
					hash: 'hashed_token',
					expiresAt: Date.now() + 100000,
				},
			];

			jwtService.decode.mockReturnValue({ jti: 'refresh-jti' });
			tokenStore.getValidTokens.mockResolvedValue(storedTokens);
			dataEncryption.compare.mockResolvedValue(true);
			tokenStore.saveTokens.mockResolvedValue(undefined);

			const result = await service.logout(userId, refreshToken);

			expect(tokenStore.getValidTokens).toHaveBeenCalledWith(userId);
			expect(result).toEqual({ message: 'Logged out successfully' });
		});

		it('should throw UnauthorizedException if no refresh token provided', async () => {
			await expect(service.logout('user123', '')).rejects.toThrow(
				UnauthorizedException,
			);
			await expect(service.logout('user123', '')).rejects.toThrow(
				'Refresh token is required',
			);
		});

		it('should throw UnauthorizedException if no active sessions', async () => {
			tokenStore.getValidTokens.mockResolvedValue([]);

			await expect(service.logout('user123', 'token')).rejects.toThrow(
				UnauthorizedException,
			);
			await expect(service.logout('user123', 'token')).rejects.toThrow(
				'No active sessions found',
			);
		});

		it('should throw UnauthorizedException if token not found in cache', async () => {
			const storedTokens = [
				{
					jti: 'different-jti',
					hash: 'different_hash',
					expiresAt: Date.now() + 100000,
				},
			];
			jwtService.decode.mockReturnValue({ jti: 'refresh-jti' });
			tokenStore.getValidTokens.mockResolvedValue(storedTokens);
			dataEncryption.compare.mockResolvedValue(false);

			await expect(
				service.logout('user123', 'invalid_token'),
			).rejects.toThrow(UnauthorizedException);
			await expect(
				service.logout('user123', 'invalid_token'),
			).rejects.toThrow('Invalid token');
		});

		it('should keep other tokens when logging out one session', async () => {
			const userId = 'user123';
			const storedTokens = [
				{
					jti: 'jti-1',
					hash: 'token1',
					expiresAt: Date.now() + 100000,
				},
				{
					jti: 'jti-2',
					hash: 'token2',
					expiresAt: Date.now() + 200000,
				},
			];

			jwtService.decode.mockReturnValue({ jti: 'jti-1' });
			tokenStore.getValidTokens.mockResolvedValue(storedTokens);
			dataEncryption.compare.mockResolvedValueOnce(true);
			tokenStore.saveTokens.mockResolvedValue(undefined);

			await service.logout(userId, 'refresh_token');

			expect(tokenStore.saveTokens).toHaveBeenCalled();
			const calls = tokenStore.saveTokens.mock.calls;
			expect(calls[0][1]).toHaveLength(1);
		});
	});

	describe('logoutAll', () => {
		it('should logout all sessions successfully', async () => {
			const userId = 'user123';
			const storedTokens = [
				{
					jti: 'jti-1',
					hash: 'token1',
					expiresAt: Date.now() + 100000,
				},
				{
					jti: 'jti-2',
					hash: 'token2',
					expiresAt: Date.now() + 200000,
				},
			];

			tokenStore.getValidTokens.mockResolvedValue(storedTokens);
			tokenStore.removeAllTokens.mockResolvedValue(undefined);

			const result = await service.logoutAll(userId);

			expect(tokenStore.removeAllTokens).toHaveBeenCalledWith(userId);
			expect(result).toEqual({
				message: 'All sessions logged out successfully',
			});
		});

		it('should throw UnauthorizedException if no active sessions', async () => {
			tokenStore.getValidTokens.mockResolvedValue([]);

			await expect(service.logoutAll('user123')).rejects.toThrow(
				UnauthorizedException,
			);
			await expect(service.logoutAll('user123')).rejects.toThrow(
				'No active sessions found',
			);
		});
	});

	describe('refreshTokens', () => {
		it('should refresh tokens successfully', async () => {
			const userId = 'user123';
			const oldRefreshToken = 'old_refresh_token';
			const user = {
				id: userId,
				email: 'test@example.com',
				roles: [{ id: '1', name: 'user' }],
			};
			const storedTokens = [
				{
					jti: 'old-jti',
					hash: 'hashed_token',
					expiresAt: Date.now() + 100000,
				},
			];

			jwtService.decode.mockReturnValue({ jti: 'old-jti' });
			tokenStore.getValidTokens.mockResolvedValue(storedTokens);
			dataEncryption.compare.mockResolvedValue(true);
			userRepository.findOne.mockResolvedValue(user);
			jwtService.signAsync
				.mockResolvedValueOnce('new_access')
				.mockResolvedValueOnce('new_refresh');
			jwtService.decode
				.mockReturnValueOnce({ jti: 'old-jti' })
				.mockReturnValueOnce({ jti: 'new-jti' });
			dataEncryption.encrypt.mockResolvedValue('new_hashed_token');
			tokenStore.saveTokens.mockResolvedValue(undefined);

			const result = await service.refreshTokens(userId, oldRefreshToken);

			expect(result).toHaveProperty('accessToken');
			expect(result).toHaveProperty('refreshToken');
			expect(tokenStore.addToken).toHaveBeenCalled();
		});

		it('should throw UnauthorizedException if no refresh token provided', async () => {
			await expect(service.refreshTokens('user123', '')).rejects.toThrow(
				UnauthorizedException,
			);
			await expect(service.refreshTokens('user123', '')).rejects.toThrow(
				'Refresh token is required',
			);
		});

		it('should throw UnauthorizedException if no valid session found', async () => {
			tokenStore.getValidTokens.mockResolvedValue([]);

			await expect(
				service.refreshTokens('user123', 'token'),
			).rejects.toThrow(UnauthorizedException);
			await expect(
				service.refreshTokens('user123', 'token'),
			).rejects.toThrow('No valid session found');
		});

		it('should throw UnauthorizedException if refresh token is invalid', async () => {
			const storedTokens = [
				{
					jti: 'old-jti',
					hash: 'hashed',
					expiresAt: Date.now() + 100000,
				},
			];
			jwtService.decode.mockReturnValue({ jti: 'missing-jti' });
			tokenStore.getValidTokens.mockResolvedValue(storedTokens);

			await expect(
				service.refreshTokens('user123', 'invalid_token'),
			).rejects.toThrow(UnauthorizedException);
			await expect(
				service.refreshTokens('user123', 'invalid_token'),
			).rejects.toThrow('Refresh token reuse detected');
		});

		it('should revoke only the token family when reuse is detected with familyId', async () => {
			const storedTokens = [
				{
					jti: 'old-jti',
					hash: 'hashed',
					expiresAt: Date.now() + 100000,
					familyId: 'family-a',
				},
				{
					jti: 'other-jti',
					hash: 'hashed-2',
					expiresAt: Date.now() + 100000,
					familyId: 'family-b',
				},
			];
			jwtService.decode.mockReturnValue({
				jti: 'missing-jti',
				familyId: 'family-a',
			});
			tokenStore.getValidTokens.mockResolvedValue(storedTokens);

			await expect(
				service.refreshTokens('user123', 'invalid_token'),
			).rejects.toThrow('Refresh token reuse detected');

			expect(tokenStore.revokeTokenFamily).toHaveBeenCalledWith(
				'user123',
				'family-a',
				storedTokens,
			);
			expect(tokenStore.removeAllTokens).not.toHaveBeenCalled();
		});

		it('should throw UnauthorizedException if user not found', async () => {
			const storedTokens = [
				{
					jti: 'old-jti',
					hash: 'hashed',
					expiresAt: Date.now() + 100000,
				},
			];
			jwtService.decode.mockReturnValue({ jti: 'old-jti' });
			tokenStore.getValidTokens.mockImplementation(() =>
				Promise.resolve([...storedTokens]),
			);
			dataEncryption.compare.mockResolvedValue(true);
			userRepository.findOne.mockResolvedValue(null);

			await expect(
				service.refreshTokens('user123', 'token'),
			).rejects.toThrow(UnauthorizedException);
			await expect(
				service.refreshTokens('user123', 'token'),
			).rejects.toThrow('User not found');
		});

		it('should remove old token and add new token', async () => {
			const userId = 'user123';
			const storedTokens = [
				{
					jti: 'old-jti',
					hash: 'old_token',
					expiresAt: Date.now() + 100000,
				},
				{
					jti: 'other-jti',
					hash: 'another_token',
					expiresAt: Date.now() + 200000,
				},
			];
			const user = {
				id: userId,
				email: 'test@example.com',
				roles: [{ id: '1', name: 'user' }],
			};

			jwtService.decode
				.mockReturnValueOnce({ jti: 'old-jti' })
				.mockReturnValueOnce({ jti: 'new-jti' });
			tokenStore.getValidTokens.mockResolvedValue(storedTokens);
			dataEncryption.compare.mockResolvedValueOnce(true);
			userRepository.findOne.mockResolvedValue(user);
			jwtService.signAsync.mockResolvedValue('token');
			dataEncryption.encrypt.mockResolvedValue('new_hashed');

			await service.refreshTokens(userId, 'old_refresh');

			const calls = tokenStore.addToken.mock.calls;
			expect(calls[0][2]).toHaveLength(1); // One token remains after removing the old one
		});

		it('should reject concurrent refresh attempts when lock is held', async () => {
			tokenStore.runWithRefreshLock.mockRejectedValueOnce(
				new UnauthorizedException('Refresh already in progress'),
			);

			await expect(
				service.refreshTokens('user123', 'refresh_token'),
			).rejects.toThrow('Refresh already in progress');
		});
	});
});
