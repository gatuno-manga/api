import { StoredTokenDto } from '@auth/application/dto/stored-token.dto';
import { SessionAuditService } from '@auth/infrastructure/adapters/session-audit.service';
import { SessionManagementService } from '@auth/infrastructure/adapters/session-management.service';
import { TokenStoreService } from '@auth/infrastructure/adapters/token-store.service';
import {
	AuthFlowResult,
	AuthRequestContext,
	GenerateTokensOptions,
	SuccessfulAuthResult,
} from '@auth/types/auth-security.types';
import {
	Inject,
	Injectable,
	Logger,
	UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataEncryptionProvider } from 'src/infrastructure/encryption/data-encryption.provider';
import { User } from 'src/users/infrastructure/database/entities/user.entity';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class RefreshTokenUseCase {
	private readonly logger = new Logger(RefreshTokenUseCase.name);

	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		private readonly jwtService: JwtService,
		private readonly tokenStore: TokenStoreService,
		private readonly sessionAudit: SessionAuditService,
		private readonly sessionManagement: SessionManagementService,
		private readonly dataEncryption: DataEncryptionProvider,
	) {}

	async execute(
		userId: string,
		oldRefreshToken: string,
		context: AuthRequestContext,
		generateTokensForUser: (
			user: User,
			options: GenerateTokensOptions,
		) => Promise<SuccessfulAuthResult>,
	): Promise<SuccessfulAuthResult> {
		if (!oldRefreshToken) {
			throw new UnauthorizedException('Refresh token is required');
		}

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
				await this.handleTokenReuse(
					userId,
					refreshTokenMeta,
					validTokens,
					context,
				);
				throw new UnauthorizedException('Refresh token reuse detected');
			}

			const tokenMatch = await this.dataEncryption.compare(
				validTokens[indexToRemove].hash,
				oldRefreshToken,
			);

			if (!tokenMatch) {
				await this.handleTokenReuse(
					userId,
					refreshTokenMeta,
					validTokens,
					context,
					'hash_mismatch',
				);
				throw new UnauthorizedException('Refresh token reuse detected');
			}

			const rotatedToken = validTokens[indexToRemove];
			validTokens.splice(indexToRemove, 1);

			const user = await this.userRepository.findOne({
				where: { id: userId },
				relations: ['roles', 'roles.permissions'],
			});

			if (!user) {
				this.logger.error('User not found during token refresh', {
					userId,
				});
				throw new UnauthorizedException('User not found');
			}

			const currentFamilyId =
				rotatedToken?.familyId ?? refreshTokenMeta.familyId ?? uuidv7();
			const currentSessionId =
				rotatedToken?.sessionId ??
				refreshTokenMeta.sessionId ??
				uuidv7();

			const tokens = await generateTokensForUser(user, {
				authMethod: 'password',
				context: context,
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

	private getRefreshTokenMetadata(refreshToken: string) {
		const decoded = this.jwtService.decode<{
			jti?: string;
			familyId?: string;
			sessionId?: string;
		}>(refreshToken);

		if (!decoded || typeof decoded !== 'object') {
			return { jti: null, familyId: null, sessionId: null };
		}

		return {
			jti: decoded.jti || null,
			familyId: decoded.familyId || null,
			sessionId: decoded.sessionId || null,
		};
	}

	private async handleTokenReuse(
		userId: string,
		meta: { jti: string | null; familyId: string | null },
		validTokens: StoredTokenDto[],
		context: AuthRequestContext,
		reason?: string,
	) {
		this.logger.error('Refresh token reuse detected', {
			userId,
			refreshTokenId: meta.jti,
			familyId: meta.familyId,
			reason,
		});

		this.sessionAudit.track({
			userId,
			event: 'refresh_reuse_detected',
			success: false,
			context: context,
			metadata: {
				refreshTokenId: meta.jti,
				familyId: meta.familyId,
				reason,
			},
		});

		if (meta.familyId) {
			const revokedCount = await this.tokenStore.revokeTokenFamily(
				userId,
				meta.familyId,
				validTokens,
			);
			await this.sessionManagement.revokeSessionsByFamily(
				userId,
				meta.familyId,
				'refresh_reuse',
			);
			this.sessionAudit.track({
				userId,
				event: 'refresh_family_revoked',
				success: true,
				context: context,
				metadata: {
					familyId: meta.familyId,
					revokedCount,
				},
			});
		} else {
			await this.tokenStore.removeAllTokens(userId);
			await this.sessionManagement.revokeAllSessions(userId, {
				reason: 'refresh_reuse',
			});
		}
	}
}
