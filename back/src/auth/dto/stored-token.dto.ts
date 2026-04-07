export class StoredTokenDto {
	jti: string;
	hash: string;
	expiresAt: number;
	familyId?: string;
	parentJti?: string;
	usedAt?: number;
	revokedAt?: number;
}
