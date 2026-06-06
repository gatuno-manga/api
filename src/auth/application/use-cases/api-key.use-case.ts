import { randomBytes } from 'node:crypto';
import { SessionAuditService } from '@auth/infrastructure/adapters/session-audit.service';
import { SessionManagementService } from '@auth/infrastructure/adapters/session-management.service';
import { LoginApiKey } from '@auth/infrastructure/database/entities/login-api-key.entity';
import {
	AuthRequestContext,
	GenerateTokensOptions,
	SuccessfulAuthResult,
} from '@auth/types/auth-security.types';
import {
	BadRequestException,
	Injectable,
	Logger,
	UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ms from 'ms';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import { DataEncryptionProvider } from 'src/infrastructure/encryption/data-encryption.provider';
import { User } from 'src/users/infrastructure/database/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ApiKeyUseCase {
	private readonly logger = new Logger(ApiKeyUseCase.name);

	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(LoginApiKey)
		private readonly loginApiKeyRepository: Repository<LoginApiKey>,
		private readonly configService: AppConfigService,
		private readonly dataEncryption: DataEncryptionProvider,
		private readonly sessionAudit: SessionAuditService,
		private readonly sessionManagement: SessionManagementService,
	) {}

	async createForAdminSelf(
		userId: string,
		options: {
			expiresIn?: string;
			singleUse?: boolean;
			context: AuthRequestContext;
		},
	): Promise<{
		apiKey: string;
		expiresAt: Date;
		singleUse: boolean;
	}> {
		const user = await this.userRepository.findOne({
			where: { id: userId },
			relations: ['roles'],
		});

		if (!user) {
			throw new UnauthorizedException('User not found');
		}

		const isAdmin = user.roles.some((role) => role.name === 'admin');
		if (!isAdmin) {
			throw new UnauthorizedException(
				'Only admins can create login API keys',
			);
		}

		const ttl = this.resolveLoginApiKeyTtl(options.expiresIn);
		const expiresAt = new Date(Date.now() + ttl);
		const keySecret = randomBytes(32).toString('hex');
		const keyHash = await this.dataEncryption.encrypt(keySecret);

		const createdApiKey = await this.loginApiKeyRepository.save(
			this.loginApiKeyRepository.create({
				userId,
				keyHash,
				singleUse: options.singleUse ?? false,
				expiresAt,
				usedAt: null,
				lastUsedAt: null,
				revokedAt: null,
				createdByUserId: userId,
			}),
		);

		this.sessionAudit.track({
			userId,
			event: 'api_key_created',
			success: true,
			context: {
				...options.context,
				authMethod: 'api_key',
				riskLevel: 'low',
			},
			metadata: {
				apiKeyId: createdApiKey.id,
				singleUse: createdApiKey.singleUse,
				expiresAt: createdApiKey.expiresAt.toISOString(),
			},
		});

		return {
			apiKey: `${createdApiKey.id}.${keySecret}`,
			expiresAt: createdApiKey.expiresAt,
			singleUse: createdApiKey.singleUse,
		};
	}

	async signIn(
		apiKey: string,
		context: AuthRequestContext,
		generateTokensForUser: (
			user: User,
			options: GenerateTokensOptions,
		) => Promise<SuccessfulAuthResult>,
	): Promise<SuccessfulAuthResult> {
		const { keyId, secret } = this.parseLoginApiKey(apiKey);
		const loginApiKey = await this.loginApiKeyRepository.findOne({
			where: { id: keyId },
		});

		if (!loginApiKey) {
			this.trackApiKeyLoginFailure('api_key_not_found', context, {
				apiKeyId: keyId,
			});
			throw new UnauthorizedException('Invalid API key');
		}

		if (loginApiKey.revokedAt) {
			this.trackApiKeyLoginFailure(
				'api_key_revoked',
				context,
				{ apiKeyId: keyId },
				loginApiKey.userId,
			);
			throw new UnauthorizedException('Invalid API key');
		}

		if (loginApiKey.expiresAt.getTime() <= Date.now()) {
			this.trackApiKeyLoginFailure(
				'api_key_expired',
				context,
				{ apiKeyId: keyId },
				loginApiKey.userId,
			);
			throw new UnauthorizedException('API key expired');
		}

		const isSecretValid = await this.dataEncryption.compare(
			loginApiKey.keyHash,
			secret,
		);
		if (!isSecretValid) {
			this.trackApiKeyLoginFailure(
				'api_key_secret_mismatch',
				context,
				{ apiKeyId: keyId },
				loginApiKey.userId,
			);
			throw new UnauthorizedException('Invalid API key');
		}

		if (loginApiKey.singleUse && loginApiKey.usedAt) {
			this.trackApiKeyLoginFailure(
				'api_key_already_used',
				context,
				{ apiKeyId: keyId },
				loginApiKey.userId,
			);
			throw new UnauthorizedException('API key already used');
		}

		const user = await this.userRepository.findOne({
			where: { id: loginApiKey.userId },
			relations: ['roles', 'roles.permissions'],
		});

		if (!user) {
			this.trackApiKeyLoginFailure(
				'api_key_user_not_found',
				context,
				{ apiKeyId: keyId },
				loginApiKey.userId,
			);
			throw new UnauthorizedException('User not found');
		}

		const now = new Date();
		loginApiKey.lastUsedAt = now;
		if (loginApiKey.singleUse) {
			loginApiKey.usedAt = now;
		}
		await this.loginApiKeyRepository.save(loginApiKey);

		return generateTokensForUser(user, {
			authMethod: 'api_key',
			context,
			mfaVerified: true,
			riskLevel: 'low',
			auditEvent: 'login_success',
		});
	}

	private resolveLoginApiKeyTtl(expiresIn?: string): number {
		const configuredMaxTtl = this.configService.authApiKeyMaxTtl;
		const configuredDefaultTtl = this.configService.authApiKeyDefaultTtl;
		const defaultTtl = Math.min(configuredDefaultTtl, configuredMaxTtl);

		if (!expiresIn || expiresIn.trim().length === 0) {
			return defaultTtl;
		}

		let parsedDuration: number | undefined;
		try {
			parsedDuration = ms(expiresIn.trim() as ms.StringValue);
		} catch {
			parsedDuration = undefined;
		}

		if (parsedDuration === undefined || parsedDuration <= 0) {
			throw new BadRequestException('Invalid API key expiration');
		}

		if (parsedDuration > configuredMaxTtl) {
			throw new BadRequestException(
				`API key expiration exceeds maximum allowed value (${this.configService.security.authApiKeyMaxExpiration})`,
			);
		}

		return parsedDuration;
	}

	private parseLoginApiKey(apiKey: string): {
		keyId: string;
		secret: string;
	} {
		const trimmedApiKey = apiKey.trim();
		const separatorIndex = trimmedApiKey.indexOf('.');
		if (
			separatorIndex <= 0 ||
			separatorIndex === trimmedApiKey.length - 1
		) {
			throw new UnauthorizedException('Invalid API key');
		}

		return {
			keyId: trimmedApiKey.slice(0, separatorIndex),
			secret: trimmedApiKey.slice(separatorIndex + 1),
		};
	}

	private trackApiKeyLoginFailure(
		reason: string,
		context: AuthRequestContext,
		metadata?: Record<string, unknown>,
		userId?: string,
	): void {
		this.sessionAudit.track({
			userId,
			event: 'login_failed',
			success: false,
			context: {
				...context,
				authMethod: 'api_key',
			},
			metadata: {
				reason,
				...(metadata ?? {}),
			},
		});
	}
}
