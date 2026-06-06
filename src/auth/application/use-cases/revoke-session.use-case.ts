import { SessionAuditService } from '@auth/infrastructure/adapters/session-audit.service';
import { SessionManagementService } from '@auth/infrastructure/adapters/session-management.service';
import { TokenStoreService } from '@auth/infrastructure/adapters/token-store.service';
import { AuthRequestContext } from '@auth/types/auth-security.types';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

@Injectable()
export class RevokeSessionUseCase {
	private readonly logger = new Logger(RevokeSessionUseCase.name);

	constructor(
		private readonly tokenStore: TokenStoreService,
		private readonly sessionAudit: SessionAuditService,
		private readonly sessionManagement: SessionManagementService,
	) {}

	async execute(
		userId: string,
		sessionId: string,
		reason: string | undefined,
		context: AuthRequestContext,
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
			context: context,
			metadata: {
				reason: reason ?? 'manual_revoke',
				sessionId,
			},
		});

		return { message: 'Session revoked successfully' };
	}

	async executeOther(
		userId: string,
		currentSessionId: string | null | undefined,
		context: AuthRequestContext,
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
				...context,
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
}
