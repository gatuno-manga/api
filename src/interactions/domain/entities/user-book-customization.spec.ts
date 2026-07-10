import { BookId } from '@common/domain/value-objects/book-id.vo';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { UserBookCustomization } from './user-book-customization';

describe('UserBookCustomization', () => {
	const userIdStr = '123e4567-e89b-12d3-a456-426614174000';
	const bookIdStr = '123e4567-e89b-12d3-a456-426614174001';
	const userId = UserId.create(userIdStr);
	const bookId = BookId.create(bookIdStr);

	describe('create', () => {
		it('should create a new customization with provided values', () => {
			const customization = UserBookCustomization.create(
				userId,
				bookId,
				'Custom Title',
				'http://cover.com/image.jpg',
			);

			const snapshot = customization.toSnapshot();
			expect(snapshot.userId).toBe(userIdStr);
			expect(snapshot.bookId).toBe(bookIdStr);
			expect(snapshot.customTitle).toBe('Custom Title');
			expect(snapshot.customCoverUrl).toBe('http://cover.com/image.jpg');
			expect(snapshot.createdAt).toBeInstanceOf(Date);
			expect(snapshot.updatedAt).toBeInstanceOf(Date);
		});

		it('should create with null values if not provided', () => {
			const customization = UserBookCustomization.create(userId, bookId);

			const snapshot = customization.toSnapshot();
			expect(snapshot.customTitle).toBeNull();
			expect(snapshot.customCoverUrl).toBeNull();
		});
	});

	describe('update', () => {
		it('should update properties', () => {
			const customization = UserBookCustomization.create(
				userId,
				bookId,
				'Initial Title',
				'http://initial.com',
			);

			customization.update('Updated Title', null);

			const snapshot = customization.toSnapshot();
			expect(snapshot.customTitle).toBe('Updated Title');
			expect(snapshot.customCoverUrl).toBeNull();
		});
	});
});
