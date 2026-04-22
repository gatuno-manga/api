export class User {
	id: string;
	userName: string;
	name: string | null;
	email: string;
	maxWeightSensitiveContent: number;
	profileImagePath: string | null;
	profileBannerPath: string | null;
	isBanned: boolean;
	suspendedUntil: Date | null;
	suspensionReason: string | null;
	createdAt: Date;
	updatedAt: Date;
}
