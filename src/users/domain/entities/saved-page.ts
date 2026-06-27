import { UserId } from '@common/domain/value-objects/user-id.vo';

export interface SavedPageSnapshot {
	id: string;
	userId: string;
	pageId: number;
	chapterId: string;
	bookId: string;
	comment: string | null;
	isPublic: boolean;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	// Optional relation details for read queries
	page?: Record<string, unknown>;
	chapter?: Record<string, unknown>;
	book?: Record<string, unknown>;
}

export class SavedPage {
	private constructor(
		private readonly id: string,
		private readonly userId: UserId,
		private readonly pageId: number,
		private readonly chapterId: string,
		private readonly bookId: string,
		private comment: string | null,
		private isPublic: boolean,
		private readonly createdAt: Date,
		private updatedAt: Date,
		private deletedAt: Date | null,
		private readonly pageDetails?: Record<string, unknown>,
		private readonly chapterDetails?: Record<string, unknown>,
		private readonly bookDetails?: Record<string, unknown>,
	) {}

	public static create(
		id: string,
		userId: UserId,
		pageId: number,
		chapterId: string,
		bookId: string,
		comment: string | null,
		isPublic: boolean,
	): SavedPage {
		const now = new Date();
		return new SavedPage(
			id,
			userId,
			pageId,
			chapterId,
			bookId,
			comment,
			isPublic,
			now,
			now,
			null,
		);
	}

	public static restore(snapshot: SavedPageSnapshot): SavedPage {
		return new SavedPage(
			snapshot.id,
			UserId.create(snapshot.userId),
			snapshot.pageId,
			snapshot.chapterId,
			snapshot.bookId,
			snapshot.comment,
			snapshot.isPublic,
			snapshot.createdAt,
			snapshot.updatedAt,
			snapshot.deletedAt,
			snapshot.page,
			snapshot.chapter,
			snapshot.book,
		);
	}

	public updateComment(comment: string | null): void {
		this.comment = comment;
		this.updatedAt = new Date();
	}

	public updateVisibility(isPublic: boolean): void {
		this.isPublic = isPublic;
		this.updatedAt = new Date();
	}

	public restoreDeleted(comment: string | null, isPublic: boolean): void {
		this.deletedAt = null;
		this.comment = comment;
		this.isPublic = isPublic;
		this.updatedAt = new Date();
	}

	public markAsDeleted(): void {
		this.deletedAt = new Date();
		this.updatedAt = new Date();
	}

	public isDeleted(): boolean {
		return this.deletedAt !== null;
	}

	public get page(): number {
		return this.pageId;
	}

	public toSnapshot(): SavedPageSnapshot {
		return {
			id: this.id,
			userId: this.userId.toString(),
			pageId: this.pageId,
			chapterId: this.chapterId,
			bookId: this.bookId,
			comment: this.comment,
			isPublic: this.isPublic,
			createdAt: this.createdAt,
			updatedAt: this.updatedAt,
			deletedAt: this.deletedAt,
			page: this.pageDetails,
			chapter: this.chapterDetails,
			book: this.bookDetails,
		};
	}
}
