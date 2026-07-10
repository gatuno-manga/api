import { IBookRepository } from '@/books/application/ports/book-repository.interface';
import { IUserBookCustomizationRepository } from '@/interactions/application/ports/user-book-customization-repository.interface';
import { UserBookCustomization } from '@/interactions/domain/entities/user-book-customization';
import { BookId } from '@common/domain/value-objects/book-id.vo';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

export interface CustomizeUserBookDto {
	userId: string;
	bookId: string;
	customTitle?: string | null;
	customCoverUrl?: string | null;
}

@Injectable()
export class CustomizeUserBookUseCase {
	constructor(
		@Inject('UserBookCustomizationRepository')
		private readonly customizationRepo: IUserBookCustomizationRepository,
		@Inject('IBookRepository')
		private readonly bookRepo: IBookRepository,
	) {}

	async execute(dto: CustomizeUserBookDto): Promise<UserBookCustomization> {
		const bookExists = await this.bookRepo.exists(dto.bookId);
		if (!bookExists) {
			throw new NotFoundException(`Book ${dto.bookId} not found`);
		}

		const userIdVO = UserId.create(dto.userId);
		const bookIdVO = BookId.create(dto.bookId);

		let customization = await this.customizationRepo.findByUserIdAndBookId(
			dto.userId,
			dto.bookId,
		);

		if (customization) {
			customization.update(
				dto.customTitle !== undefined
					? dto.customTitle
					: customization.toSnapshot().customTitle,
				dto.customCoverUrl !== undefined
					? dto.customCoverUrl
					: customization.toSnapshot().customCoverUrl,
			);
		} else {
			customization = UserBookCustomization.create(
				userIdVO,
				bookIdVO,
				dto.customTitle ?? null,
				dto.customCoverUrl ?? null,
			);
		}

		await this.customizationRepo.save(customization);
		return customization;
	}
}
