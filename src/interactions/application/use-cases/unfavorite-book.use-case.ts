import { FavoriteRepository } from '@/interactions/application/ports/favorite-repository.port';
import { BookId } from '@common/domain/value-objects/book-id.vo';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class UnfavoriteBookUseCase {
	constructor(
		@Inject('FavoriteRepository')
		private readonly favoriteRepository: FavoriteRepository,
	) {}

	async execute(userId: UserId, bookId: BookId): Promise<void> {
		const isFavorite = await this.favoriteRepository.isFavorite(
			userId,
			bookId,
		);
		if (!isFavorite) {
			throw new NotFoundException('Favorite not found');
		}

		await this.favoriteRepository.delete(userId, bookId);
	}
}
