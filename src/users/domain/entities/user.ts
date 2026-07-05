import { Image } from '@common/domain/value-objects/image.vo';

export class User {
	id: string;
	userName: string;
	name: string | null;
	email: string;
	maxWeightSensitiveContent: number;
	profilePicture: Image | null;
	profileBanner: Image | null;
	isBanned: boolean;
	suspendedUntil: Date | null;
	suspensionReason: string | null;
	preferredLanguage: string;
	contentLanguages: string[];
	preferences: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
}
