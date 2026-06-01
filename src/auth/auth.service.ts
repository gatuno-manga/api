import { randomBytes } from 'node:crypto';
import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import ms from 'ms';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import { DataEncryptionProvider } from 'src/infrastructure/encryption/data-encryption.provider';
import { PasswordEncryption } from 'src/infrastructure/encryption/password-encryption.provider';
import { PasswordMigrationService } from 'src/infrastructure/encryption/password-migration.service';
import { Role } from 'src/users/infrastructure/database/entities/role.entity';
import { User } from 'src/users/infrastructure/database/entities/user.entity';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { JwtPayloadBuilder } from './application/builders/jwt-payload.builder';
import { StoredTokenDto } from './application/dto/stored-token.dto';
import { UserAuthData } from './application/ports/user-repository.port';
import { ApiKeyUseCase } from './application/use-cases/api-key.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { RevokeSessionUseCase } from './application/use-cases/revoke-session.use-case';
import { SignInUseCase } from './application/use-cases/sign-in.use-case';
import { SignOutUseCase } from './application/use-cases/sign-out.use-case';
import { SignUpUseCase } from './application/use-cases/sign-up.use-case';
import { MfaService } from './infrastructure/adapters/mfa.service';
import { SessionAuditService } from './infrastructure/adapters/session-audit.service';
import { SessionManagementService } from './infrastructure/adapters/session-management.service';
import { TokenStoreService } from './infrastructure/adapters/token-store.service';
import { LoginApiKey } from './infrastructure/database/entities/login-api-key.entity';
import { ListAuthAuditQueryDto } from './infrastructure/http/dto/list-auth-audit-query.dto';
import {
	AuthFlowResult,
	AuthMethod,
	AuthRequestContext,
	AuthRiskLevel,
	GenerateTokensOptions,
	SessionAuditEvent,
	SuccessfulAuthResult,
	TokenRotationInput,
	isPendingMfaResult,
} from './types/auth-security.types';

interface MfaChallengePayload {
	sub: string;
	email: string;
	purpose: 'mfa-login';
	authMethod: AuthMethod;
	riskLevel: AuthRiskLevel;
	context: AuthRequestContext;
}

interface CreateLoginApiKeyOptions {
	expiresIn?: string;
	singleUse?: boolean;
	context?: AuthRequestContext;
}

@Injectable()
export class AuthService {
	public readonly logger = new Logger(AuthService.name);

	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(Role) readonly _roleRepository: Repository<Role>,
		@InjectRepository(LoginApiKey)
		private readonly loginApiKeyRepository: Repository<LoginApiKey>,
		private readonly passwordEncryption: PasswordEncryption,
		private readonly passwordMigration: PasswordMigrationService,
		private readonly dataEncryption: DataEncryptionProvider,
		private readonly jwtService: JwtService,
		private readonly configService: AppConfigService,
		private readonly tokenStore: TokenStoreService,
		private readonly sessionAudit: SessionAuditService,
		private readonly sessionManagement: SessionManagementService,
		private readonly mfaService: MfaService,
		private readonly signUpUseCase: SignUpUseCase,
		private readonly signInUseCase: SignInUseCase,
		private readonly refreshTokenUseCase: RefreshTokenUseCase,
		private readonly signOutUseCase: SignOutUseCase,
		private readonly revokeSessionUseCase: RevokeSessionUseCase,
		private readonly apiKeyUseCase: ApiKeyUseCase,
	) {
		this.logger.log(
			`🔐 Algoritmo de hashing ativo: ${this.passwordEncryption.getAlgorithm()}`,
		);
	}

	private normalizeRequestContext(
		context?: AuthRequestContext,
	): AuthRequestContext {
		return {
			ipAddress: context?.ipAddress?.trim() || null,
			userAgent: context?.userAgent?.trim() || null,
			clientPlatform:
				context?.clientPlatform?.trim().toLowerCase() || 'web',
			deviceId: context?.deviceId?.trim() || null,
			deviceLabel: context?.deviceLabel?.trim() || null,
		};
	}

	private isMobileContext(context?: AuthRequestContext): boolean {
		const platform = context?.clientPlatform?.toLowerCase().trim();
		return ['mobile', 'flutter', 'app', 'native'].includes(platform ?? '');
	}

	async signUp(email: string, password: string, isAdmin = false) {
		return this.signUpUseCase.execute(email, password, isAdmin);
	}

	private async resolveRiskLevel(
		userId: string,
		context?: AuthRequestContext,
	): Promise<AuthRiskLevel> {
		const normalizedContext = this.normalizeRequestContext(context);
		const knownDevice = await this.sessionManagement.hasKnownDevice(
			userId,
			normalizedContext,
		);
		return knownDevice ? 'low' : 'high';
	}

	private async createMfaChallengeToken(
		user: User | UserAuthData,
		authMethod: AuthMethod,
		riskLevel: AuthRiskLevel,
		context: AuthRequestContext,
	): Promise<string> {
		const payload: MfaChallengePayload = {
			sub: user.id,
			email: user.email,
			purpose: 'mfa-login',
			authMethod,
			riskLevel,
			context,
		};

		return this.jwtService.signAsync(payload, {
			secret: this.configService.jwt.accessSecret,
			expiresIn: this.configService.security.mfaChallengeExpiration,
			issuer: this.configService.jwt.issuer,
			audience: this.configService.jwt.audience,
		});
	}

	private async issueAuthFlowForUser(
		user: User | UserAuthData,
		options: {
			authMethod: AuthMethod;
			context?: AuthRequestContext;
		},
	): Promise<AuthFlowResult> {
		const normalizedContext = this.normalizeRequestContext(options.context);
		const riskLevel = await this.resolveRiskLevel(
			user.id,
			normalizedContext,
		);
		const mfaEnabled = await this.mfaService.isTotpEnabled(user.id);
		const stepUpEnabled =
			this.configService.security.mfaStepUpEnabled &&
			!this.isMobileContext(normalizedContext);

		if (mfaEnabled && stepUpEnabled && riskLevel === 'high') {
			const mfaToken = await this.createMfaChallengeToken(
				user,
				options.authMethod,
				riskLevel,
				normalizedContext,
			);

			this.sessionAudit.track({
				userId: user.id,
				event: 'mfa_challenge_issued',
				success: true,
				context: {
					...normalizedContext,
					authMethod: options.authMethod,
					riskLevel,
				},
				metadata: {
					reason: 'new_device_or_risk',
				},
			});

			return {
				mfaRequired: true,
				mfaType: 'totp',
				mfaToken,
			};
		}

		const auditEvent: SessionAuditEvent =
			options.authMethod === 'passkey'
				? 'passkey_login_success'
				: 'login_success';

		return this.generateTokensForUser(user, {
			authMethod: options.authMethod,
			context: normalizedContext,
			mfaVerified: false,
			riskLevel,
			auditEvent,
		});
	}

	private async findUserWithPasswordById(
		userId: string,
	): Promise<User | null> {
		return this.userRepository
			.createQueryBuilder('user')
			.leftJoinAndSelect('user.roles', 'role')
			.addSelect('user.password')
			.where('user.id = :id', { id: userId })
			.getOne();
	}

	private async migratePasswordWhenPossible(
		fullUser: User,
		plainPassword: string,
	): Promise<void> {
		if (!fullUser.password) {
			this.logger.warn(
				`Password hash unavailable for user ${fullUser.id}. Password migration skipped.`,
			);
			return;
		}

		try {
			const wasMigrated =
				await this.passwordMigration.migratePasswordOnLogin(
					fullUser,
					plainPassword,
				);

			if (!wasMigrated) {
				return;
			}

			this.logger.log(
				`🔄 Senha do usuário ${fullUser.email} migrada com sucesso para ${this.passwordEncryption.getAlgorithm()}`,
			);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'unknown_error';
			this.logger.warn(
				`Password migration skipped for user ${fullUser.id}: ${errorMessage}`,
			);
		}
	}

	async signIn(
		email: string,
		password: string,
		context?: AuthRequestContext,
	): Promise<AuthFlowResult> {
		return this.signInUseCase.execute(
			email,
			password,
			context,
			async (user, authMethod, context) => {
				const fullUser = await this.findUserWithPasswordById(user.id);
				if (fullUser) {
					await this.migratePasswordWhenPossible(fullUser, password);
				}

				return this.issueAuthFlowForUser(fullUser || user, {
					authMethod: authMethod as AuthMethod,
					context,
				});
			},
		);
	}

	async createLoginApiKeyForAdminSelf(
		userId: string,
		options?: CreateLoginApiKeyOptions,
	): Promise<{
		apiKey: string;
		expiresAt: Date;
		singleUse: boolean;
	}> {
		const normalizedContext = this.normalizeRequestContext(
			options?.context,
		);
		return this.apiKeyUseCase.createForAdminSelf(userId, {
			expiresIn: options?.expiresIn,
			singleUse: options?.singleUse,
			context: normalizedContext,
		});
	}

	async signInWithApiKey(
		apiKey: string,
		context?: AuthRequestContext,
	): Promise<SuccessfulAuthResult> {
		const normalizedContext = this.normalizeRequestContext(context);
		return this.apiKeyUseCase.signIn(
			apiKey,
			normalizedContext,
			async (user, options) => this.generateTokensForUser(user, options),
		);
	}

	async completePasskeySignIn(
		user: User,
		context?: AuthRequestContext,
	): Promise<AuthFlowResult> {
		return this.issueAuthFlowForUser(user, {
			authMethod: 'passkey',
			context,
		});
	}

	async verifyMfaAndCompleteSignIn(
		mfaToken: string,
		code: string,
	): Promise<SuccessfulAuthResult> {
		let payload: MfaChallengePayload;
		try {
			payload = await this.jwtService.verifyAsync<MfaChallengePayload>(
				mfaToken,
				{
					secret: this.configService.jwt.accessSecret,
					issuer: this.configService.jwt.issuer,
					audience: this.configService.jwt.audience,
				},
			);
		} catch {
			throw new UnauthorizedException('Invalid MFA challenge token');
		}

		if (payload.purpose !== 'mfa-login') {
			throw new UnauthorizedException(
				'Invalid MFA challenge token purpose',
			);
		}

		const isValidMfaCode = await this.mfaService.verifyLoginCode(
			payload.sub,
			code,
		);
		if (!isValidMfaCode) {
			this.sessionAudit.track({
				userId: payload.sub,
				event: 'mfa_verify_failed',
				success: false,
				context: {
					...(payload.context ?? {}),
					authMethod: payload.authMethod,
					riskLevel: payload.riskLevel,
				},
			});
			throw new UnauthorizedException('Invalid MFA code');
		}

		const user = await this.userRepository.findOne({
			where: { id: payload.sub },
			relations: ['roles'],
		});
		if (!user) {
			throw new UnauthorizedException('User not found');
		}

		this.sessionAudit.track({
			userId: payload.sub,
			event: 'mfa_verify_success',
			success: true,
			context: {
				...(payload.context ?? {}),
				authMethod: payload.authMethod,
				riskLevel: payload.riskLevel,
			},
		});

		const auditEvent: SessionAuditEvent =
			payload.authMethod === 'passkey'
				? 'passkey_login_success'
				: 'login_success';

		return this.generateTokensForUser(user, {
			authMethod: payload.authMethod,
			context: payload.context,
			mfaVerified: true,
			riskLevel: payload.riskLevel,
			auditEvent,
		});
	}

	async getMfaStatus(userId: string): Promise<{
		totpEnabled: boolean;
		backupCodesRemaining: number;
	}> {
		return this.mfaService.getStatus(userId);
	}

	async beginTotpSetup(
		userId: string,
		context?: AuthRequestContext,
	): Promise<{ secret: string; otpauthUri: string }> {
		const result = await this.mfaService.beginTotpSetup(userId);
		this.sessionAudit.track({
			userId,
			event: 'mfa_totp_setup_started',
			success: true,
			context: this.normalizeRequestContext(context),
		});
		return result;
	}

	async verifyTotpSetup(
		userId: string,
		code: string,
		context?: AuthRequestContext,
	): Promise<{ enabled: boolean; backupCodes: string[] }> {
		const result = await this.mfaService.verifyTotpSetup(userId, code);
		this.sessionAudit.track({
			userId,
			event: 'mfa_totp_setup_completed',
			success: true,
			context: this.normalizeRequestContext(context),
		});
		return result;
	}

	async disableTotp(
		userId: string,
		code: string,
		context?: AuthRequestContext,
	): Promise<{ enabled: boolean }> {
		await this.mfaService.disableTotp(userId, code);
		this.sessionAudit.track({
			userId,
			event: 'mfa_totp_disabled',
			success: true,
			context: this.normalizeRequestContext(context),
		});
		return { enabled: false };
	}

	private async getTokens(
		user: User | UserAuthData,
		rotation?: TokenRotationInput,
	): Promise<{
		accessToken: string;
		refreshToken: string;
		refreshTokenId: string;
		refreshTokenFamilyId: string;
		sessionId: string;
	}> {
		if (!user.roles || user.roles.length === 0) {
			throw new BadRequestException('User has no roles assigned');
		}

		const sessionId = rotation?.sessionId ?? uuidv7();
		const payload = new JwtPayloadBuilder()
			.fromUser(user)
			.setIssuer(this.configService.jwt.issuer)
			.setSessionId(sessionId)
			.build();

		const refreshTokenId = uuidv7();
		const refreshTokenFamilyId = rotation?.familyId ?? uuidv7();
		const refreshPayload = {
			...payload,
			jti: refreshTokenId,
			familyId: refreshTokenFamilyId,
			parentJti: rotation?.parentJti,
			sessionId,
		};

		const [accessToken, refreshToken] = await Promise.all([
			this.jwtService.signAsync(payload, {
				secret: this.configService.jwt.accessSecret,
				expiresIn: this.configService.jwt.accessExpiration,
				audience: this.configService.jwt.audience,
			}),
			this.jwtService.signAsync(refreshPayload, {
				secret: this.configService.jwt.refreshSecret,
				expiresIn: this.configService.jwt.refreshExpiration,
				audience: this.configService.jwt.audience,
			}),
		]);

		return {
			accessToken,
			refreshToken,
			refreshTokenId,
			refreshTokenFamilyId,
			sessionId,
		};
	}

	async generateTokensForUser(
		user: User | UserAuthData,
		options?: GenerateTokensOptions,
	): Promise<SuccessfulAuthResult> {
		const normalizedContext = this.normalizeRequestContext(
			options?.context,
		);
		const authMethod = options?.authMethod ?? 'password';
		const riskLevel = options?.riskLevel ?? 'low';
		const mfaVerified = options?.mfaVerified ?? false;
		const sessionId = options?.sessionId ?? uuidv7();
		const tokens = await this.getTokens(user, {
			sessionId,
			familyId: options?.rotation?.familyId,
			parentJti: options?.rotation?.parentJti,
		});

		const hashedToken = await this.dataEncryption.encrypt(
			tokens.refreshToken,
		);
		await this.tokenStore.addToken(
			user.id,
			{
				hash: hashedToken,
				jti: tokens.refreshTokenId,
				sessionId: tokens.sessionId,
				familyId: tokens.refreshTokenFamilyId,
				parentJti: options?.rotation?.parentJti,
			},
			options?.existingTokens,
		);

		if (options?.rotation?.previousRefreshTokenJti) {
			await this.sessionManagement.rotateSessionToken({
				userId: user.id,
				sessionId: tokens.sessionId,
				previousRefreshTokenJti:
					options.rotation.previousRefreshTokenJti,
				newRefreshTokenJti: tokens.refreshTokenId,
				newFamilyId: tokens.refreshTokenFamilyId,
				context: normalizedContext,
			});
			return this.finalizeTokenGeneration(
				user,
				tokens,
				authMethod,
				mfaVerified,
				riskLevel,
				normalizedContext,
				options,
			);
		}

		await this.sessionManagement.createSession({
			userId: user.id,
			sessionId: tokens.sessionId,
			refreshTokenJti: tokens.refreshTokenId,
			refreshTokenFamilyId: tokens.refreshTokenFamilyId,
			authMethod,
			mfaVerified,
			riskLevel,
			context: normalizedContext,
		});

		return this.finalizeTokenGeneration(
			user,
			tokens,
			authMethod,
			mfaVerified,
			riskLevel,
			normalizedContext,
			options,
		);
	}

	private finalizeTokenGeneration(
		user: User | UserAuthData,
		tokens: SuccessfulAuthResult & {
			refreshTokenId: string;
			refreshTokenFamilyId: string;
		},
		authMethod: string,
		mfaVerified: boolean,
		riskLevel: string,
		normalizedContext: AuthRequestContext,
		options?: GenerateTokensOptions,
	): SuccessfulAuthResult {
		const event = options?.auditEvent ?? 'login_success';
		this.sessionAudit.track({
			userId: user.id,
			event,
			success: true,
			context: {
				...normalizedContext,
				sessionId: tokens.sessionId,
				authMethod: authMethod as AuthMethod,
				riskLevel: riskLevel as AuthRiskLevel,
			},
			metadata: {
				refreshTokenId: tokens.refreshTokenId,
				familyId: tokens.refreshTokenFamilyId,
				mfaVerified,
			},
		});

		return {
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			sessionId: tokens.sessionId,
		};
	}

	async logout(
		userId: string,
		refreshToken: string,
		context?: AuthRequestContext,
	): Promise<{ message: string }> {
		const normalizedContext = this.normalizeRequestContext(context);
		return this.signOutUseCase.execute(
			userId,
			refreshToken,
			normalizedContext,
		);
	}

	async logoutAll(
		userId: string,
		context?: AuthRequestContext,
	): Promise<{ message: string }> {
		const normalizedContext = this.normalizeRequestContext(context);
		return this.signOutUseCase.executeAll(userId, normalizedContext);
	}

	async refreshTokens(
		userId: string,
		oldRefreshToken: string,
		context?: AuthRequestContext,
	): Promise<SuccessfulAuthResult> {
		const normalizedContext = this.normalizeRequestContext(context);

		return this.refreshTokenUseCase.execute(
			userId,
			oldRefreshToken,
			normalizedContext,
			async (user, options) => this.generateTokensForUser(user, options),
		);
	}

	async listActiveSessions(
		userId: string,
		currentSessionId?: string | null,
	): Promise<
		Array<{
			id: string;
			deviceLabel: string | null;
			deviceId: string | null;
			clientPlatform: string | null;
			ipAddress: string | null;
			userAgent: string | null;
			authMethod: AuthMethod;
			mfaVerified: boolean;
			riskLevel: AuthRiskLevel;
			lastSeenAt: Date;
			createdAt: Date;
			isCurrent: boolean;
		}>
	> {
		const sessions =
			await this.sessionManagement.listActiveSessions(userId);
		return sessions.map((session) => ({
			id: session.id,
			deviceLabel: session.deviceLabel,
			deviceId: session.deviceId,
			clientPlatform: session.clientPlatform,
			ipAddress: session.ipAddress,
			userAgent: session.userAgent,
			authMethod: session.authMethod,
			mfaVerified: session.mfaVerified,
			riskLevel: session.riskLevel,
			lastSeenAt: session.lastSeenAt,
			createdAt: session.createdAt,
			isCurrent: Boolean(
				currentSessionId && session.id === currentSessionId,
			),
		}));
	}

	async revokeSession(
		userId: string,
		sessionId: string,
		reason?: string,
		context?: AuthRequestContext,
	): Promise<{ message: string }> {
		const normalizedContext = this.normalizeRequestContext(context);
		return this.revokeSessionUseCase.execute(
			userId,
			sessionId,
			reason,
			normalizedContext,
		);
	}

	async revokeOtherSessions(
		userId: string,
		currentSessionId?: string | null,
		context?: AuthRequestContext,
	): Promise<{ message: string; revokedSessions: number }> {
		const normalizedContext = this.normalizeRequestContext(context);
		return this.revokeSessionUseCase.executeOther(
			userId,
			currentSessionId,
			normalizedContext,
		);
	}

	async getAuditHistory(userId: string, query: ListAuthAuditQueryDto) {
		return this.sessionAudit.listUserAuditHistory(userId, {
			page: query.page,
			limit: query.limit,
			event: query.event,
			cursor: query.cursor,
		});
	}
}
