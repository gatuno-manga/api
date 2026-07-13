import { UserBookCustomization } from '@/interactions/domain/entities/user-book-customization';
import { NotFoundException } from '@nestjs/common';
import { CustomizeUserBookUseCase } from './customize-user-book.use-case';

describe('CustomizeUserBookUseCase', () => {
	let useCase: CustomizeUserBookUseCase;
	let customizationRepoMock: any;
	let bookRepoMock: any;

	const userId = '123e4567-e89b-12d3-a456-426614174000';
	const bookId = '123e4567-e89b-12d3-a456-426614174001';

	beforeEach(() => {
		customizationRepoMock = {
			findByUserIdAndBookId: jest.fn(),
			save: jest.fn(),
		};
		bookRepoMock = {
			exists: jest.fn(),
		};

		useCase = new CustomizeUserBookUseCase(
			customizationRepoMock,
			bookRepoMock,
		);
	});

	describe('execute', () => {
		it('should throw NotFoundException if book does not exist', async () => {
			// Arrange
			bookRepoMock.exists.mockResolvedValue(false);

			// Act & Assert
			await expect(
				useCase.execute({
					userId,
					bookId,
				}),
			).rejects.toThrow(NotFoundException);
		});

		it('should create a new customization if it does not exist', async () => {
			// Arrange
			bookRepoMock.exists.mockResolvedValue(true);
			customizationRepoMock.findByUserIdAndBookId.mockResolvedValue(null);

			// Act
			const result = await useCase.execute({
				userId,
				bookId,
				customTitle: 'My Title',
				customCoverUrl: 'http://cover.com',
			});

			// Assert
			expect(result).toBeInstanceOf(UserBookCustomization);
			const snapshot = result.toSnapshot();
			expect(snapshot.customTitle).toBe('My Title');
			expect(snapshot.customCoverUrl).toBe('http://cover.com');
			expect(customizationRepoMock.save).toHaveBeenCalledWith(result);
		});

		it('should update an existing customization', async () => {
			// Arrange
			bookRepoMock.exists.mockResolvedValue(true);

			const existingCustomization = UserBookCustomization.restore({
				userId,
				bookId,
				customTitle: 'Old Title',
				customCoverUrl: 'http://old.com',
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			customizationRepoMock.findByUserIdAndBookId.mockResolvedValue(
				existingCustomization,
			);

			// Act
			const result = await useCase.execute({
				userId,
				bookId,
				customTitle: 'New Title',
			});

			// Assert
			expect(result).toBeInstanceOf(UserBookCustomization);
			const snapshot = result.toSnapshot();
			expect(snapshot.customTitle).toBe('New Title');
			expect(snapshot.customCoverUrl).toBe('http://old.com'); // Unchanged
			expect(customizationRepoMock.save).toHaveBeenCalledWith(
				existingCustomization,
			);
		});
	});
});
