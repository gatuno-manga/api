import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuthSession } from '../entities/auth-session.entity';
import {
	AuthMethod,
	AuthRequestContext,
	AuthRiskLevel,
} from '../types/auth-security.types';

interface CreateSessionInput {
	userId: string;
	sessionId: string;
	refreshTokenJti: string;
	refreshTokenFamilyId?: string;
	authMethod: AuthMethod;
	mfaVerified: boolean;
	riskLevel: AuthRiskLevel;
	context?: AuthRequestContext;
}

interface RotateSessionTokenInput {
	userId: string;
	sessionId?: string | null;
	previousRefreshTokenJti?: string | null;
	newRefreshTokenJti: string;
	newFamilyId?: string | null;
	context?: AuthRequestContext;
}

@Injectable()
export class SessionManagementService {
	constructor(
		@InjectRepository(AuthSession)
		private readonly sessionRepository: Repository<AuthSession>,
	) {}

	private buildFingerprint(context?: AuthRequestContext): string | null {
		if (context?.deviceId && context.deviceId.trim().length > 0) {
			return context.deviceId.trim();
		}

		const userAgent = context?.userAgent?.trim();
		const platform = context?.clientPlatform?.trim();
		if (!userAgent) {
			return null;
		}

		return `${platform ?? 'unknown'}:${userAgent.toLowerCase().slice(0, 180)}`;
	}

	async hasKnownDevice(
		userId: string,
		context?: AuthRequestContext,
	): Promise<boolean> {
		const fingerprint = this.buildFingerprint(context);
		if (!fingerprint) {
			return false;
		}

		return this.sessionRepository.exists({
			where: {
				userId,
				sessionFingerprint: fingerprint,
			},
		});
	}

	async createSession(input: CreateSessionInput): Promise<AuthSession> {
		const now = new Date();
		const fingerprint = this.buildFingerprint(input.context);
		return this.sessionRepository.save(
			this.sessionRepository.create({
				id: input.sessionId,
				userId: input.userId,
				refreshTokenJti: input.refreshTokenJti,
				refreshTokenFamilyId: input.refreshTokenFamilyId ?? null,
				authMethod: input.authMethod,
				mfaVerified: input.mfaVerified,
				riskLevel: input.riskLevel,
				ipAddress: input.context?.ipAddress ?? null,
				userAgent: input.context?.userAgent ?? null,
				clientPlatform: input.context?.clientPlatform ?? null,
				deviceId: input.context?.deviceId ?? null,
				deviceLabel: input.context?.deviceLabel ?? null,
				sessionFingerprint: fingerprint,
				lastSeenAt: now,
				revokedAt: null,
				revokeReason: null,
			}),
		);
	}

	async rotateSessionToken(input: RotateSessionTokenInput): Promise<void> {
		let session: AuthSession | null = null;

		if (input.sessionId) {
			session = await this.sessionRepository.findOne({
				where: {
					id: input.sessionId,
					userId: input.userId,
					revokedAt: IsNull(),
				},
			});
		}

		if (!session && input.previousRefreshTokenJti) {
			session = await this.sessionRepository.findOne({
				where: {
					userId: input.userId,
					refreshTokenJti: input.previousRefreshTokenJti,
					revokedAt: IsNull(),
				},
			});
		}

		if (!session) {
			return;
		}

		session.refreshTokenJti = input.newRefreshTokenJti;
		session.refreshTokenFamilyId =
			input.newFamilyId ?? session.refreshTokenFamilyId;
		session.lastSeenAt = new Date();

		if (input.context) {
			session.ipAddress = input.context.ipAddress ?? session.ipAddress;
			session.userAgent = input.context.userAgent ?? session.userAgent;
			session.clientPlatform =
				input.context.clientPlatform ?? session.clientPlatform;
			session.deviceId = input.context.deviceId ?? session.deviceId;
			session.deviceLabel =
				input.context.deviceLabel ?? session.deviceLabel;
			const fingerprint = this.buildFingerprint(input.context);
			if (fingerprint) {
				session.sessionFingerprint = fingerprint;
			}
		}

		await this.sessionRepository.save(session);
	}

	async touchSession(
		userId: string,
		refreshTokenJti?: string | null,
		context?: AuthRequestContext,
	): Promise<void> {
		if (!refreshTokenJti) {
			return;
		}

		const session = await this.sessionRepository.findOne({
			where: { userId, refreshTokenJti, revokedAt: IsNull() },
		});
		if (!session) {
			return;
		}

		session.lastSeenAt = new Date();
		if (context) {
			session.ipAddress = context.ipAddress ?? session.ipAddress;
			session.userAgent = context.userAgent ?? session.userAgent;
			session.clientPlatform =
				context.clientPlatform ?? session.clientPlatform;
			session.deviceId = context.deviceId ?? session.deviceId;
			session.deviceLabel = context.deviceLabel ?? session.deviceLabel;
		}
		await this.sessionRepository.save(session);
	}

	async revokeSessionByRefreshTokenJti(
		userId: string,
		refreshTokenJti: string,
		reason = 'manual_revoke',
	): Promise<void> {
		const session = await this.sessionRepository.findOne({
			where: { userId, refreshTokenJti, revokedAt: IsNull() },
		});
		if (!session) {
			return;
		}

		session.revokedAt = new Date();
		session.revokeReason = reason;
		await this.sessionRepository.save(session);
	}

	async revokeSessionById(
		userId: string,
		sessionId: string,
		reason = 'manual_revoke',
	): Promise<AuthSession | null> {
		const session = await this.sessionRepository.findOne({
			where: { id: sessionId, userId, revokedAt: IsNull() },
		});
		if (!session) {
			return null;
		}

		session.revokedAt = new Date();
		session.revokeReason = reason;
		await this.sessionRepository.save(session);
		return session;
	}

	async revokeSessionsByFamily(
		userId: string,
		familyId: string,
		reason = 'family_revoked',
	): Promise<number> {
		const sessions = await this.sessionRepository.find({
			where: {
				userId,
				refreshTokenFamilyId: familyId,
				revokedAt: IsNull(),
			},
		});
		if (sessions.length === 0) {
			return 0;
		}

		const now = new Date();
		for (const session of sessions) {
			session.revokedAt = now;
			session.revokeReason = reason;
		}
		await this.sessionRepository.save(sessions);
		return sessions.length;
	}

	async revokeAllSessions(
		userId: string,
		options?: {
			exceptSessionId?: string | null;
			reason?: string;
		},
	): Promise<AuthSession[]> {
		const activeSessions = await this.sessionRepository.find({
			where: { userId, revokedAt: IsNull() },
			order: { lastSeenAt: 'DESC' },
		});

		const sessionsToRevoke = activeSessions.filter((session) => {
			if (!options?.exceptSessionId) {
				return true;
			}
			return session.id !== options.exceptSessionId;
		});

		if (sessionsToRevoke.length === 0) {
			return [];
		}

		const now = new Date();
		for (const session of sessionsToRevoke) {
			session.revokedAt = now;
			session.revokeReason = options?.reason ?? 'logout_all';
		}
		await this.sessionRepository.save(sessionsToRevoke);
		return sessionsToRevoke;
	}

	async listActiveSessions(userId: string): Promise<AuthSession[]> {
		return this.sessionRepository.find({
			where: { userId, revokedAt: IsNull() },
			order: {
				lastSeenAt: 'DESC',
			},
		});
	}
}
