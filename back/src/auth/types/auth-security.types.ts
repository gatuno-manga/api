export type AuthMethod = 'password' | 'passkey';

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

export const isPendingMfaResult = (
	result: AuthFlowResult,
): result is PendingMfaAuthResult => {
	return 'mfaRequired' in result && result.mfaRequired === true;
};
