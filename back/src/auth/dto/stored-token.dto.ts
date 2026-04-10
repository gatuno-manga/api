export class StoredTokenDto {
	jti: string;
	hash: string;
	expiresAt: number;
	sessionId?: string;
	familyId?: string;
	parentJti?: string;
	usedAt?: number;
	revokedAt?: number;
}
