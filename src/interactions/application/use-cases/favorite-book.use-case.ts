import { FavoriteRepository } from '@/interactions/application/ports/favorite-repository.port';
import { Favorite } from '@/interactions/domain/entities/favorite';
import { BookId } from '@common/domain/value-objects/book-id.vo';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class FavoriteBookUseCase {
	constructor(
		@Inject('FavoriteRepository')
		private readonly favoriteRepository: FavoriteRepository,
	) {}

	async execute(userId: string, bookId: string): Promise<void> {
		const user = UserId.create(userId);
		const book = BookId.create(bookId);
		const favorite = Favorite.create(user, book);
		await this.favoriteRepository.save(favorite);
	}
}
