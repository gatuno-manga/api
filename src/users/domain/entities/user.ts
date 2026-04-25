import { Image } from '../../../common/domain/value-objects/image.vo';

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
	createdAt: Date;
	updatedAt: Date;
}
