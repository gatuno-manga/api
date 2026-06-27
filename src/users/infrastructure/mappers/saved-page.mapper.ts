import {
	SavedPage as DomainSavedPage,
	SavedPageSnapshot,
} from '@users/domain/entities/saved-page';
import { SavedPage as OrmSavedPage } from '@users/infrastructure/database/entities/saved-page.entity';
import { User } from '@users/infrastructure/database/entities/user.entity';
import { Book } from 'src/books/infrastructure/database/entities/book.entity';
import { Chapter } from 'src/books/infrastructure/database/entities/chapter.entity';
import { Page } from 'src/books/infrastructure/database/entities/page.entity';

export const SavedPageMapper = {
	toDomain(entity: OrmSavedPage): DomainSavedPage {
		const snapshot = {
			id: entity.id,
			userId: entity.user?.id,
			pageId: entity.page?.id,
			chapterId: entity.chapter?.id,
			bookId: entity.book?.id,
			comment: entity.comment,
			isPublic: entity.isPublic,
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt,
			deletedAt: entity.deletedAt,
			page: entity.page as unknown as Record<string, unknown>,
			chapter: entity.chapter as unknown as Record<string, unknown>,
			book: entity.book as unknown as Record<string, unknown>,
		};
		return DomainSavedPage.restore(
			snapshot as unknown as SavedPageSnapshot,
		);
	},

	toOrm(domain: DomainSavedPage): OrmSavedPage {
		const snapshot = domain.toSnapshot();
		const entity = new OrmSavedPage();

		entity.id = snapshot.id;

		if (snapshot.userId) {
			entity.user = new User();
			entity.user.id = snapshot.userId;
		}

		if (snapshot.pageId) {
			entity.page = new Page();
			entity.page.id = snapshot.pageId;
		}

		if (snapshot.chapterId) {
			entity.chapter = new Chapter();
			entity.chapter.id = snapshot.chapterId;
		}

		if (snapshot.bookId) {
			entity.book = new Book();
			entity.book.id = snapshot.bookId;
		}

		entity.comment = snapshot.comment;
		entity.isPublic = snapshot.isPublic;
		entity.createdAt = snapshot.createdAt;
		entity.updatedAt = snapshot.updatedAt;
		entity.deletedAt = snapshot.deletedAt;

		return entity;
	},
};
