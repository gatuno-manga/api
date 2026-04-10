import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { AppConfigService } from 'src/app-config/app-config.service';
import { DataEncryptionProvider } from 'src/encryption/data-encryption.provider';
import { PasswordEncryption } from 'src/encryption/password-encryption.provider';
import { PasswordMigrationService } from 'src/encryption/password-migration.service';
import { Role } from 'src/users/entities/role.entity';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { JwtPayloadBuilder } from './builders/jwt-payload.builder';
import { ListAuthAuditQueryDto } from './dto/list-auth-audit-query.dto';
import { StoredTokenDto } from './dto/stored-token.dto';
import {
	SessionAuditEvent,
	SessionAuditService,
} from './services/session-audit.service';
import { SessionManagementService } from './services/session-management.service';
import { MfaService } from './services/mfa.service';
import { TokenStoreService } from './services/token-store.service';
import {
	AuthFlowResult,
	AuthMethod,
	AuthRequestContext,
	AuthRiskLevel,
	SuccessfulAuthResult,
} from './types/auth-security.types';

interface TokenRotationInput {
	familyId?: string;
	parentJti?: string;
	sessionId?: string;
}

interface RefreshTokenMetadata {
	jti: string | null;
	familyId: string | null;
	sessionId: string | null;
}

interface GenerateTokensOptions {
	authMethod?: AuthMethod;
	context?: AuthRequestContext;
	mfaVerified?: boolean;
	riskLevel?: AuthRiskLevel;
	auditEvent?: SessionAuditEvent;
	sessionId?: string;
	rotation?: {
		familyId?: string;
		parentJti?: string;
		previousRefreshTokenJti?: string | null;
	};
	existingTokens?: StoredTokenDto[];
}

interface MfaChallengePayload {
	sub: string;
	email: string;
	purpose: 'mfa-login';
	authMethod: AuthMethod;
	riskLevel: AuthRiskLevel;
	context: AuthRequestContext;
}

@Injectable()
export class AuthService {
	public readonly logger = new Logger(AuthService.name);

	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(Role)
		private readonly roleRepository: Repository<Role>,
		private readonly passwordEncryption: PasswordEncryption,
		private readonly passwordMigration: PasswordMigrationService,
		private readonly dataEncryption: DataEncryptionProvider,
		private readonly jwtService: JwtService,
		private readonly configService: AppConfigService,
		private readonly tokenStore: TokenStoreService,
		private readonly sessionAudit: SessionAuditService,
		private readonly sessionManagement: SessionManagementService,
		private readonly mfaService: MfaService,
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
		const userExist = await this.userRepository.findOneBy({ email });
		if (userExist) {
			this.logger.error('User exists', userExist);
			throw new BadRequestException('User already exists');
		}

		const result = await this.passwordEncryption.encrypt(password);
		const roleName = isAdmin ? 'admin' : 'user';
		const role = await this.roleRepository.findOne({
			where: { name: roleName },
		});
		if (!role) {
			throw new BadRequestException(
				`${roleName.charAt(0).toUpperCase() + roleName.slice(1)} role not found`,
			);
		}
		const user = await this.userRepository.save(
			this.userRepository.create({
				userName: email.split('@')[0],
				email,
				password: result,
				roles: [role],
			}),
		);

		// Mantém roles no objeto retornado sem depender de novo SELECT.
		user.roles = [role];

		this.logger.log('User created', user);
		return user;
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
		user: User,
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
			secret: this.configService.jwtAccessSecret,
			expiresIn: this.configService.mfaChallengeExpiration,
			issuer: this.configService.jwtIssuer,
			audience: this.configService.jwtAudience,
		});
	}

	private async issueAuthFlowForUser(
		user: User,
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
			this.configService.mfaStepUpEnabled &&
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

	async signIn(
		email: string,
		password: string,
		context?: AuthRequestContext,
	): Promise<AuthFlowResult> {
		const normalizedContext = this.normalizeRequestContext(context);
		const user = await this.userRepository.findOne({
			where: { email },
			relations: ['roles'],
			select: ['id', 'email', 'password', 'roles'],
		});

		if (!user) {
			this.sessionAudit.track({
				event: 'login_failed',
				success: false,
				context: normalizedContext,
				metadata: {
					email,
					reason: 'user_not_found',
				},
			});
			this.logger.error('User not exists', email);
			throw new UnauthorizedException('User not exists');
		}

		if (!(await this.passwordEncryption.compare(user.password, password))) {
			this.sessionAudit.track({
				userId: user.id,
				event: 'login_failed',
				success: false,
				context: normalizedContext,
				metadata: {
					reason: 'invalid_password',
				},
			});
			this.logger.error('Invalid password', email);
			throw new UnauthorizedException('Invalid password');
		}

		const wasMigrated = await this.passwordMigration.migratePasswordOnLogin(
			user,
			password,
		);
		if (wasMigrated) {
			this.logger.log(
				`🔄 Senha do usuário ${user.email} migrada com sucesso para ${this.passwordEncryption.getAlgorithm()}`,
			);
		}

		return this.issueAuthFlowForUser(user, {
			authMethod: 'password',
			context: normalizedContext,
		});
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
					secret: this.configService.jwtAccessSecret,
					issuer: this.configService.jwtIssuer,
					audience: this.configService.jwtAudience,
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
		user: User,
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

		const sessionId = rotation?.sessionId ?? randomUUID();
		const payload = new JwtPayloadBuilder()
			.fromUser(user)
			.setIssuer(this.configService.jwtIssuer)
			.setSessionId(sessionId)
			.build();

		const refreshTokenId = randomUUID();
		const refreshTokenFamilyId = rotation?.familyId ?? randomUUID();
		const refreshPayload = {
			...payload,
			jti: refreshTokenId,
			familyId: refreshTokenFamilyId,
			parentJti: rotation?.parentJti,
			sessionId,
		};

		const [accessToken, refreshToken] = await Promise.all([
			this.jwtService.signAsync(payload, {
				secret: this.configService.jwtAccessSecret,
				expiresIn: this.configService.jwtAccessExpiration,
				audience: this.configService.jwtAudience,
			}),
			this.jwtService.signAsync(refreshPayload, {
				secret: this.configService.jwtRefreshSecret,
				expiresIn: this.configService.jwtRefreshExpiration,
				audience: this.configService.jwtAudience,
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
		user: User,
		options?: GenerateTokensOptions,
	): Promise<SuccessfulAuthResult> {
		const normalizedContext = this.normalizeRequestContext(
			options?.context,
		);
		const authMethod = options?.authMethod ?? 'password';
		const riskLevel = options?.riskLevel ?? 'low';
		const mfaVerified = options?.mfaVerified ?? false;
		const sessionId = options?.sessionId ?? randomUUID();
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
		} else {
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
		}

		const event = options?.auditEvent ?? 'login_success';
		this.sessionAudit.track({
			userId: user.id,
			event,
			success: true,
			context: {
				...normalizedContext,
				sessionId: tokens.sessionId,
				authMethod,
				riskLevel,
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

	private getRefreshTokenMetadata(
		refreshToken: string,
	): RefreshTokenMetadata {
		const decoded = this.jwtService.decode<{
			jti?: unknown;
			familyId?: unknown;
			sessionId?: unknown;
		}>(refreshToken);
		if (!decoded || typeof decoded !== 'object') {
			return { jti: null, familyId: null, sessionId: null };
		}

		const tokenId = decoded.jti;
		const familyId = decoded.familyId;
		const sessionId = decoded.sessionId;

		return {
			jti:
				typeof tokenId === 'string' && tokenId.length > 0
					? tokenId
					: null,
			familyId:
				typeof familyId === 'string' && familyId.length > 0
					? familyId
					: null,
			sessionId:
				typeof sessionId === 'string' && sessionId.length > 0
					? sessionId
					: null,
		};
	}

	async logout(
		userId: string,
		refreshToken: string,
		context?: AuthRequestContext,
	): Promise<{ message: string }> {
		if (!refreshToken) {
			throw new UnauthorizedException('Refresh token is required');
		}

		const validTokens = await this.tokenStore.getValidTokens(userId);
		if (validTokens.length === 0) {
			this.logger.warn('No active sessions found for user', { userId });
			throw new UnauthorizedException('No active sessions found');
		}

		const refreshTokenMeta = this.getRefreshTokenMetadata(refreshToken);
		let indexToRemove = -1;

		if (refreshTokenMeta.jti) {
			indexToRemove = validTokens.findIndex(
				(token) => token.jti === refreshTokenMeta.jti,
			);

			if (indexToRemove >= 0) {
				const tokenMatch = await this.dataEncryption.compare(
					validTokens[indexToRemove].hash,
					refreshToken,
				);

				if (!tokenMatch) {
					indexToRemove = -1;
				}
			}
		} else {
			for (let i = 0; i < validTokens.length; i++) {
				if (
					await this.dataEncryption.compare(
						validTokens[i].hash,
						refreshToken,
					)
				) {
					indexToRemove = i;
					break;
				}
			}
		}

		if (indexToRemove === -1) {
			this.logger.error('Token not found in cache', { userId });
			throw new UnauthorizedException('Invalid token');
		}

		const removedToken = validTokens[indexToRemove];
		validTokens.splice(indexToRemove, 1);
		await this.tokenStore.saveTokens(userId, validTokens);
		await this.sessionManagement.revokeSessionByRefreshTokenJti(
			userId,
			removedToken.jti,
			'user_logout',
		);

		this.sessionAudit.track({
			userId,
			event: 'logout_success',
			success: true,
			context: {
				...this.normalizeRequestContext(context),
				sessionId: removedToken.sessionId ?? refreshTokenMeta.sessionId,
			},
			metadata: {
				remainingSessions: validTokens.length,
			},
		});

		this.logger.log(
			`Token removed for user ${userId}. Remaining tokens: ${validTokens.length}`,
		);

		return { message: 'Logged out successfully' };
	}

	async logoutAll(
		userId: string,
		context?: AuthRequestContext,
	): Promise<{ message: string }> {
		const validTokens = await this.tokenStore.getValidTokens(userId);
		if (validTokens.length === 0) {
			this.logger.warn('No active sessions found for user', { userId });
			throw new UnauthorizedException('No active sessions found');
		}

		await this.tokenStore.removeAllTokens(userId);
		await this.sessionManagement.revokeAllSessions(userId, {
			reason: 'logout_all',
		});

		this.sessionAudit.track({
			userId,
			event: 'logout_all_success',
			success: true,
			context: this.normalizeRequestContext(context),
			metadata: {
				revokedSessions: validTokens.length,
			},
		});

		this.logger.log(
			`All sessions (${validTokens.length}) logged out for user ${userId}`,
		);
		return { message: 'All sessions logged out successfully' };
	}

	async refreshTokens(
		userId: string,
		oldRefreshToken: string,
		context?: AuthRequestContext,
	): Promise<SuccessfulAuthResult> {
		if (!oldRefreshToken) {
			throw new UnauthorizedException('Refresh token is required');
		}

		const normalizedContext = this.normalizeRequestContext(context);

		return this.tokenStore.runWithRefreshLock(userId, async () => {
			const validTokens = await this.tokenStore.getValidTokens(userId);

			if (validTokens.length === 0) {
				this.logger.warn('No valid session found for user', { userId });
				throw new UnauthorizedException('No valid session found');
			}

			const refreshTokenMeta =
				this.getRefreshTokenMetadata(oldRefreshToken);
			if (!refreshTokenMeta.jti) {
				throw new UnauthorizedException('Invalid refresh token');
			}

			const indexToRemove = validTokens.findIndex(
				(token) => token.jti === refreshTokenMeta.jti,
			);

			if (indexToRemove === -1) {
				this.logger.error('Refresh token reuse detected', {
					userId,
					refreshTokenId: refreshTokenMeta.jti,
					familyId: refreshTokenMeta.familyId,
				});
				this.sessionAudit.track({
					userId,
					event: 'refresh_reuse_detected',
					success: false,
					context: normalizedContext,
					metadata: {
						refreshTokenId: refreshTokenMeta.jti,
						familyId: refreshTokenMeta.familyId,
					},
				});

				if (refreshTokenMeta.familyId) {
					const revokedCount =
						await this.tokenStore.revokeTokenFamily(
							userId,
							refreshTokenMeta.familyId,
							validTokens,
						);
					await this.sessionManagement.revokeSessionsByFamily(
						userId,
						refreshTokenMeta.familyId,
						'refresh_reuse',
					);
					this.sessionAudit.track({
						userId,
						event: 'refresh_family_revoked',
						success: true,
						context: normalizedContext,
						metadata: {
							familyId: refreshTokenMeta.familyId,
							revokedCount,
						},
					});
				} else {
					await this.tokenStore.removeAllTokens(userId);
					await this.sessionManagement.revokeAllSessions(userId, {
						reason: 'refresh_reuse',
					});
				}
				throw new UnauthorizedException('Refresh token reuse detected');
			}

			const tokenMatch = await this.dataEncryption.compare(
				validTokens[indexToRemove].hash,
				oldRefreshToken,
			);
			if (!tokenMatch) {
				this.logger.error('Refresh token hash mismatch detected', {
					userId,
					refreshTokenId: refreshTokenMeta.jti,
					familyId: refreshTokenMeta.familyId,
				});
				this.sessionAudit.track({
					userId,
					event: 'refresh_reuse_detected',
					success: false,
					context: normalizedContext,
					metadata: {
						refreshTokenId: refreshTokenMeta.jti,
						familyId: refreshTokenMeta.familyId,
						reason: 'hash_mismatch',
					},
				});
				if (refreshTokenMeta.familyId) {
					const revokedCount =
						await this.tokenStore.revokeTokenFamily(
							userId,
							refreshTokenMeta.familyId,
							validTokens,
						);
					await this.sessionManagement.revokeSessionsByFamily(
						userId,
						refreshTokenMeta.familyId,
						'refresh_reuse',
					);
					this.sessionAudit.track({
						userId,
						event: 'refresh_family_revoked',
						success: true,
						context: normalizedContext,
						metadata: {
							familyId: refreshTokenMeta.familyId,
							revokedCount,
						},
					});
				} else {
					await this.tokenStore.removeAllTokens(userId);
					await this.sessionManagement.revokeAllSessions(userId, {
						reason: 'refresh_reuse',
					});
				}
				throw new UnauthorizedException('Refresh token reuse detected');
			}

			const rotatedToken = validTokens[indexToRemove];
			validTokens.splice(indexToRemove, 1);

			const user = await this.userRepository.findOne({
				where: { id: userId },
				relations: ['roles'],
			});

			if (!user) {
				this.logger.error('User not found during token refresh', {
					userId,
				});
				throw new UnauthorizedException('User not found');
			}

			const currentFamilyId =
				rotatedToken?.familyId ??
				refreshTokenMeta.familyId ??
				randomUUID();
			const currentSessionId =
				rotatedToken?.sessionId ??
				refreshTokenMeta.sessionId ??
				randomUUID();

			const tokens = await this.generateTokensForUser(user, {
				authMethod: 'password',
				context: normalizedContext,
				mfaVerified: false,
				riskLevel: 'low',
				auditEvent: 'refresh_success',
				sessionId: currentSessionId,
				rotation: {
					familyId: currentFamilyId,
					parentJti: refreshTokenMeta.jti,
					previousRefreshTokenJti: refreshTokenMeta.jti,
				},
				existingTokens: validTokens,
			});

			this.logger.log(
				`Tokens refreshed for user ${userId}. Total tokens: ${validTokens.length}`,
			);
			return tokens;
		});
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
		const revokedSession = await this.sessionManagement.revokeSessionById(
			userId,
			sessionId,
			reason ?? 'manual_revoke',
		);
		if (!revokedSession) {
			throw new NotFoundException('Active session not found');
		}

		await this.tokenStore.removeTokenByJti(
			userId,
			revokedSession.refreshTokenJti,
		);
		this.sessionAudit.track({
			userId,
			event: 'session_revoked',
			success: true,
			context: {
				...this.normalizeRequestContext(context),
				sessionId,
			},
			metadata: {
				reason: reason ?? 'manual_revoke',
			},
		});

		return { message: 'Session revoked successfully' };
	}

	async revokeOtherSessions(
		userId: string,
		currentSessionId?: string | null,
		context?: AuthRequestContext,
	): Promise<{ message: string; revokedSessions: number }> {
		const revokedSessions = await this.sessionManagement.revokeAllSessions(
			userId,
			{
				exceptSessionId: currentSessionId,
				reason: 'manual_revoke_others',
			},
		);
		const revokedJtis = revokedSessions.map(
			(session) => session.refreshTokenJti,
		);
		await this.tokenStore.removeTokensByJtis(userId, revokedJtis);

		this.sessionAudit.track({
			userId,
			event: 'session_revoke_others',
			success: true,
			context: {
				...this.normalizeRequestContext(context),
				sessionId: currentSessionId ?? null,
			},
			metadata: {
				revokedSessions: revokedSessions.length,
			},
		});

		return {
			message: 'Other sessions revoked successfully',
			revokedSessions: revokedSessions.length,
		};
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
