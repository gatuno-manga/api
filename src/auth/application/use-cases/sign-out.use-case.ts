import { SessionAuditService } from '@auth/infrastructure/adapters/session-audit.service';
import { SessionManagementService } from '@auth/infrastructure/adapters/session-management.service';
import { TokenStoreService } from '@auth/infrastructure/adapters/token-store.service';
import { AuthRequestContext } from '@auth/types/auth-security.types';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataEncryptionProvider } from 'src/infrastructure/encryption/data-encryption.provider';

@Injectable()
export class SignOutUseCase {
	private readonly logger = new Logger(SignOutUseCase.name);

	constructor(
		private readonly jwtService: JwtService,
		private readonly tokenStore: TokenStoreService,
		private readonly sessionAudit: SessionAuditService,
		private readonly sessionManagement: SessionManagementService,
		private readonly dataEncryption: DataEncryptionProvider,
	) {}

	async execute(
		userId: string,
		refreshToken: string,
		context: AuthRequestContext,
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
				...context,
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

	async executeAll(
		userId: string,
		context: AuthRequestContext,
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
			context: context,
			metadata: {
				revokedSessions: validTokens.length,
			},
		});

		this.logger.log(
			`All sessions (${validTokens.length}) logged out for user ${userId}`,
		);
		return { message: 'All sessions logged out successfully' };
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
}
