import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FavoriteRepository } from '../../../application/ports/favorite-repository.port';
import { Favorite } from '../../../domain/entities/favorite';
import { UserId } from '../../../../common/domain/value-objects/user-id.vo';
import { BookId } from '../../../../common/domain/value-objects/book-id.vo';
import { FavoriteEntity } from '../entities/favorite.entity';

@Injectable()
export class TypeOrmFavoriteRepository implements FavoriteRepository {
	constructor(
		@InjectRepository(FavoriteEntity)
		private readonly repository: Repository<FavoriteEntity>,
	) {}

	async save(favorite: Favorite): Promise<void> {
		const snapshot = favorite.toSnapshot();
		const entity = this.repository.create(snapshot);
		await this.repository.save(entity);
	}

	async delete(userId: UserId, bookId: BookId): Promise<void> {
		await this.repository.delete({
			userId: userId.toString(),
			bookId: bookId.toString(),
		});
	}

	async isFavorite(userId: UserId, bookId: BookId): Promise<boolean> {
		const count = await this.repository.count({
			where: { userId: userId.toString(), bookId: bookId.toString() },
		});
		return count > 0;
	}

	async findByUser(userId: UserId): Promise<Favorite[]> {
		const entities = await this.repository.find({
			where: { userId: userId.toString() },
		});
		return entities.map((e) => Favorite.restore(e));
	}
}
