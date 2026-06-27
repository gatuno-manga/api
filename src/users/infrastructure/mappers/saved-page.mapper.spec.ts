import { UserId } from '@common/domain/value-objects/user-id.vo';
import { SavedPage as DomainSavedPage } from '@users/domain/entities/saved-page';
import { SavedPage as OrmSavedPage } from '@users/infrastructure/database/entities/saved-page.entity';
import { SavedPageMapper } from './saved-page.mapper';

describe('SavedPageMapper', () => {
	it('should map from ORM entity to Domain entity', () => {
		const ormEntity = new OrmSavedPage();
		ormEntity.id = '123';
		ormEntity.user = { id: '00000000-0000-0000-0000-000000000000' } as any;
		ormEntity.page = { id: 10 } as any;
		ormEntity.chapter = { id: 'ch-1' } as any;
		ormEntity.book = { id: 'book-1' } as any;
		ormEntity.comment = 'comment';
		ormEntity.isPublic = true;
		ormEntity.createdAt = new Date('2022-01-01');
		ormEntity.updatedAt = new Date('2022-01-02');
		ormEntity.deletedAt = null;

		const domainEntity = SavedPageMapper.toDomain(ormEntity);
		const snapshot = domainEntity.toSnapshot();

		expect(snapshot.id).toBe(ormEntity.id);
		expect(snapshot.userId).toBe(ormEntity.user.id);
		expect(snapshot.pageId).toBe(ormEntity.page.id);
		expect(snapshot.chapterId).toBe(ormEntity.chapter.id);
		expect(snapshot.bookId).toBe(ormEntity.book.id);
		expect(snapshot.comment).toBe(ormEntity.comment);
		expect(snapshot.isPublic).toBe(ormEntity.isPublic);
		expect(snapshot.createdAt).toBe(ormEntity.createdAt);
		expect(snapshot.updatedAt).toBe(ormEntity.updatedAt);
		expect(snapshot.deletedAt).toBe(ormEntity.deletedAt);
	});

	it('should map from Domain entity to ORM entity', () => {
		const userId = UserId.create('00000000-0000-0000-0000-000000000000');
		const domainEntity = DomainSavedPage.create(
			'123',
			userId,
			10,
			'ch-1',
			'book-1',
			'domain comment',
			false,
		);

		const ormEntity = SavedPageMapper.toOrm(domainEntity);
		const snapshot = domainEntity.toSnapshot();

		expect(ormEntity.id).toBe(snapshot.id);
		expect(ormEntity.user.id).toBe(snapshot.userId);
		expect(ormEntity.page.id).toBe(snapshot.pageId);
		expect(ormEntity.chapter.id).toBe(snapshot.chapterId);
		expect(ormEntity.book.id).toBe(snapshot.bookId);
		expect(ormEntity.comment).toBe(snapshot.comment);
		expect(ormEntity.isPublic).toBe(snapshot.isPublic);
		expect(ormEntity.createdAt).toBe(snapshot.createdAt);
		expect(ormEntity.updatedAt).toBe(snapshot.updatedAt);
		expect(ormEntity.deletedAt).toBe(snapshot.deletedAt);
	});
});
