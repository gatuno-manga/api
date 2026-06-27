import { UserId } from '@common/domain/value-objects/user-id.vo';
import { SavedPage } from '@users/domain/entities/saved-page';

export interface ISavedPagesRepository {
	save(savedPage: SavedPage): Promise<SavedPage>;
	findOneByPageAndUser(
		pageId: number,
		userId: UserId,
		withDeleted?: boolean,
	): Promise<SavedPage | null>;
	findByIdAndUser(id: string, userId: UserId): Promise<SavedPage | null>;
	findByUser(userId: UserId): Promise<SavedPage[]>;
	findPublicByUser(userId: UserId): Promise<SavedPage[]>;
	findPublicByBookAndUser(
		userId: UserId,
		bookId: string,
	): Promise<SavedPage[]>;
	findByBookAndUser(userId: UserId, bookId: string): Promise<SavedPage[]>;
	findByChapterAndUser(
		userId: UserId,
		chapterId: string,
	): Promise<SavedPage[]>;
	countByPageAndUser(pageId: number, userId: UserId): Promise<number>;
	countByBookAndUser(userId: UserId, bookId: string): Promise<number>;
	softRemove(savedPage: SavedPage): Promise<void>;
	findForSync(userId: UserId, lastSyncAt?: Date): Promise<SavedPage[]>;
	verifyPageOwnership(
		pageId: number,
		chapterId: string,
		bookId: string,
	): Promise<boolean>;
}

export const I_SAVED_PAGES_REPOSITORY = 'ISavedPagesRepository';
