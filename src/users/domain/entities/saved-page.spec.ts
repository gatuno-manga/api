import { UserId } from '@common/domain/value-objects/user-id.vo';
import { SavedPage } from './saved-page';

describe('SavedPage Domain Entity', () => {
	it('should create a new SavedPage', () => {
		const userId = UserId.create('00000000-0000-0000-0000-000000000000');
		const savedPage = SavedPage.create(
			'123',
			userId,
			1,
			'ch-1',
			'book-1',
			'Great page!',
			true,
		);

		expect(savedPage.isDeleted()).toBe(false);
		expect(savedPage.page).toBe(1);

		const snapshot = savedPage.toSnapshot();
		expect(snapshot.id).toBe('123');
		expect(snapshot.userId).toBe(userId.toString());
		expect(snapshot.pageId).toBe(1);
		expect(snapshot.chapterId).toBe('ch-1');
		expect(snapshot.bookId).toBe('book-1');
		expect(snapshot.comment).toBe('Great page!');
		expect(snapshot.isPublic).toBe(true);
		expect(snapshot.createdAt).toBeDefined();
		expect(snapshot.updatedAt).toBeDefined();
		expect(snapshot.deletedAt).toBeNull();
	});

	it('should update comment and visibility', () => {
		const userId = UserId.create('00000000-0000-0000-0000-000000000000');
		const savedPage = SavedPage.create(
			'123',
			userId,
			1,
			'ch-1',
			'b-1',
			null,
			false,
		);

		const oldUpdatedAt = savedPage.toSnapshot().updatedAt;

		savedPage.updateComment('New comment');
		savedPage.updateVisibility(true);

		const snapshot = savedPage.toSnapshot();
		expect(snapshot.comment).toBe('New comment');
		expect(snapshot.isPublic).toBe(true);
		expect(snapshot.updatedAt.getTime()).toBeGreaterThanOrEqual(
			oldUpdatedAt.getTime(),
		);
	});

	it('should handle soft deletion and restoration', () => {
		const userId = UserId.create('00000000-0000-0000-0000-000000000000');
		const savedPage = SavedPage.create(
			'123',
			userId,
			1,
			'ch-1',
			'b-1',
			null,
			false,
		);

		savedPage.markAsDeleted();
		expect(savedPage.isDeleted()).toBe(true);
		expect(savedPage.toSnapshot().deletedAt).not.toBeNull();

		savedPage.restoreDeleted('Restored', true);
		expect(savedPage.isDeleted()).toBe(false);

		const snapshot = savedPage.toSnapshot();
		expect(snapshot.deletedAt).toBeNull();
		expect(snapshot.comment).toBe('Restored');
		expect(snapshot.isPublic).toBe(true);
	});

	it('should restore from snapshot', () => {
		const snapshot = {
			id: 'uuid',
			userId: '00000000-0000-0000-0000-000000000000',
			pageId: 10,
			chapterId: 'ch-2',
			bookId: 'bk-2',
			comment: 'Restored comment',
			isPublic: false,
			createdAt: new Date('2020-01-01T00:00:00Z'),
			updatedAt: new Date('2020-01-02T00:00:00Z'),
			deletedAt: null,
		};

		const savedPage = SavedPage.restore(snapshot);
		const restoredSnapshot = savedPage.toSnapshot();

		expect(restoredSnapshot).toEqual(snapshot);
	});
});
