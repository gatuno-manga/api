import { StoredTokenDto } from '@auth/application/dto/stored-token.dto';

export type AuthMethod = 'password' | 'passkey' | 'api_key' | 'oauth';

export type AuthRiskLevel = 'low' | 'high';

export interface AuthRequestContext {
	ipAddress?: string | null;
	userAgent?: string | null;
	clientPlatform?: string | null;
	deviceId?: string | null;
	deviceLabel?: string | null;
}

export interface SuccessfulAuthResult {
	accessToken: string;
	refreshToken: string;
	sessionId: string;
}

export interface PendingMfaAuthResult {
	mfaRequired: true;
	mfaType: 'totp';
	mfaToken: string;
}

export type AuthFlowResult = SuccessfulAuthResult | PendingMfaAuthResult;

export interface TokenRotationInput {
	familyId?: string;
	parentJti?: string;
	sessionId?: string;
}

export interface RefreshTokenMetadata {
	jti: string | null;
	familyId: string | null;
	sessionId: string | null;
}

export type SessionAuditEvent =
	| 'login_success'
	| 'login_failed'
	| 'api_key_created'
	| 'signup_success'
	| 'passkey_login_success'
	| 'passkey_registration_success'
	| 'passkey_removed'
	| 'oauth_login_success'
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

export interface GenerateTokensOptions {
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

export const isPendingMfaResult = (
	result: AuthFlowResult,
): result is PendingMfaAuthResult => {
	return 'mfaRequired' in result && result.mfaRequired === true;
};
