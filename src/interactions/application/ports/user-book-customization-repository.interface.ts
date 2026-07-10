import { UserBookCustomization } from '@/interactions/domain/entities/user-book-customization';

export const I_USER_BOOK_CUSTOMIZATION_REPOSITORY =
	'IUserBookCustomizationRepository';

export interface IUserBookCustomizationRepository {
	findByUserIdAndBookId(
		userId: string,
		bookId: string,
	): Promise<UserBookCustomization | null>;
	save(customization: UserBookCustomization): Promise<void>;
	remove(customization: UserBookCustomization): Promise<void>;
}
