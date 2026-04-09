import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CustomLogger } from 'src/custom.logger';
import { AuthAuditLog } from '../entities/auth-audit-log.entity';
import {
	AuthMethod,
	AuthRequestContext,
	AuthRiskLevel,
} from '../types/auth-security.types';

export type SessionAuditEvent =
	| 'login_success'
	| 'login_failed'
	| 'signup_success'
	| 'passkey_login_success'
	| 'passkey_registration_success'
	| 'passkey_removed'
	| 'mfa_challenge_issued'
	| 'mfa_verify_success'
	| 'mfa_verify_failed'
	| 'mfa_totp_setup_started'
	| 'mfa_totp_setup_completed'
	| 'mfa_totp_disabled'
	| 'refresh_success'
	| 'refresh_reuse_detected'
	| 'refresh_family_revoked'
	| 'logout_success'
	| 'logout_all_success'
	| 'session_revoked'
	| 'session_revoke_others'
	| 'passkey_auth_challenge_issued'
	| 'passkey_registration_challenge_issued';

interface SessionAuditTrackContext extends AuthRequestContext {
	sessionId?: string | null;
	authMethod?: AuthMethod | null;
	riskLevel?: AuthRiskLevel | null;
}

interface SessionAuditTrackPayload {
	userId?: string | null;
	event: SessionAuditEvent;
	success?: boolean;
	metadata?: Record<string, unknown>;
	context?: SessionAuditTrackContext;
}

@Injectable()
export class SessionAuditService {
	constructor(
		private readonly logger: CustomLogger,
		@InjectRepository(AuthAuditLog)
		private readonly auditLogRepository: Repository<AuthAuditLog>,
	) {
		this.logger.setContext(SessionAuditService.name);
	}

	track(
		userId: string,
		event: SessionAuditEvent,
		metadata?: Record<string, unknown>,
	): void;
	track(payload: SessionAuditTrackPayload): void;
	track(
		userIdOrPayload: string | SessionAuditTrackPayload,
		event?: SessionAuditEvent,
		metadata?: Record<string, unknown>,
	): void {
		const payload: SessionAuditTrackPayload =
			typeof userIdOrPayload === 'string'
				? {
						userId: userIdOrPayload,
						event: event as SessionAuditEvent,
						metadata,
					}
				: userIdOrPayload;

		const success = payload.success ?? true;
		this.logger.logUserAction({
			userId: payload.userId ?? 'anonymous',
			action: `session.${payload.event}`,
			metadata: {
				...payload.metadata,
				success,
				sessionId: payload.context?.sessionId ?? null,
				authMethod: payload.context?.authMethod ?? null,
				riskLevel: payload.context?.riskLevel ?? null,
				deviceId: payload.context?.deviceId ?? null,
				clientPlatform: payload.context?.clientPlatform ?? null,
				ipAddress: payload.context?.ipAddress ?? null,
			},
		});

		const row = this.auditLogRepository.create({
			userId: payload.userId ?? null,
			event: payload.event,
			success,
			sessionId: payload.context?.sessionId ?? null,
			authMethod: payload.context?.authMethod ?? null,
			riskLevel: payload.context?.riskLevel ?? null,
			deviceId: payload.context?.deviceId ?? null,
			deviceLabel: payload.context?.deviceLabel ?? null,
			clientPlatform: payload.context?.clientPlatform ?? null,
			ipAddress: payload.context?.ipAddress ?? null,
			userAgent: payload.context?.userAgent ?? null,
			metadata: payload.metadata ?? null,
		});

		void this.auditLogRepository.save(row).catch((error: unknown) => {
			const message =
				error instanceof Error
					? error.message
					: 'unknown audit log error';
			this.logger.warn(`Failed to persist auth audit event: ${message}`);
		});
	}

	async listUserAuditHistory(
		userId: string,
		options?: { page?: number; limit?: number; event?: string },
	): Promise<{
		items: AuthAuditLog[];
		total: number;
		page: number;
		limit: number;
	}> {
		const page = Math.max(options?.page ?? 1, 1);
		const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
		const where: FindOptionsWhere<AuthAuditLog> = {
			userId,
		};

		if (options?.event) {
			where.event = options.event;
		}

		const [items, total] = await this.auditLogRepository.findAndCount({
			where,
			order: {
				createdAt: 'DESC',
			},
			skip: (page - 1) * limit,
			take: limit,
		});

		return {
			items,
			total,
			page,
			limit,
		};
	}
}
