import { Inject, Injectable } from '@nestjs/common';
import { FavoriteRepository } from '../ports/favorite-repository.port';
import { Favorite } from '../../domain/entities/favorite';
import { UserId } from '../../../common/domain/value-objects/user-id.vo';
import { BookId } from '../../../common/domain/value-objects/book-id.vo';

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
