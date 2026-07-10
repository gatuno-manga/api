import { BookId } from '@common/domain/value-objects/book-id.vo';
import { UserId } from '@common/domain/value-objects/user-id.vo';

export interface UserBookCustomizationSnapshot {
	userId: string;
	bookId: string;
	customTitle: string | null;
	customCoverUrl: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export class UserBookCustomization {
	private constructor(
		private readonly userId: UserId,
		private readonly bookId: BookId,
		private customTitle: string | null,
		private customCoverUrl: string | null,
		private readonly createdAt: Date,
		private readonly updatedAt: Date,
	) {}

	public static create(
		userId: UserId,
		bookId: BookId,
		customTitle: string | null = null,
		customCoverUrl: string | null = null,
	): UserBookCustomization {
		const now = new Date();
		return new UserBookCustomization(
			userId,
			bookId,
			customTitle,
			customCoverUrl,
			now,
			now,
		);
	}

	public static restore(
		snapshot: UserBookCustomizationSnapshot,
	): UserBookCustomization {
		return new UserBookCustomization(
			UserId.create(snapshot.userId),
			BookId.create(snapshot.bookId),
			snapshot.customTitle,
			snapshot.customCoverUrl,
			snapshot.createdAt,
			snapshot.updatedAt,
		);
	}

	public update(customTitle: string | null, customCoverUrl: string | null) {
		this.customTitle = customTitle;
		this.customCoverUrl = customCoverUrl;
	}

	public toSnapshot(): UserBookCustomizationSnapshot {
		return {
			userId: this.userId.toString(),
			bookId: this.bookId.toString(),
			customTitle: this.customTitle,
			customCoverUrl: this.customCoverUrl,
			createdAt: this.createdAt,
			updatedAt: this.updatedAt,
		};
	}
}
