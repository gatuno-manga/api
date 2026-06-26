import { FavoriteRepository } from '@/interactions/application/ports/favorite-repository.port';
import { Favorite } from '@/interactions/domain/entities/favorite';
import { FavoriteEntity } from '@/interactions/infrastructure/database/entities/favorite.entity';
import { BookId } from '@common/domain/value-objects/book-id.vo';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, MoreThanOrEqual, Repository } from 'typeorm';

@Injectable()
export class TypeOrmFavoriteRepository implements FavoriteRepository {
	constructor(
		@InjectRepository(FavoriteEntity)
		private readonly repository: Repository<FavoriteEntity>,
	) {}

	async save(favorite: Favorite): Promise<void> {
		const snapshot = favorite.toSnapshot();
		const existing = await this.repository.findOne({
			where: { userId: snapshot.userId, bookId: snapshot.bookId },
			withDeleted: true,
		});

		if (existing) {
			if (existing.deletedAt) {
				existing.deletedAt = null;
				await this.repository.save(existing);
			}
			return;
		}

		const entity = this.repository.create(snapshot);
		await this.repository.save(entity);
	}

	async delete(userId: UserId, bookId: BookId): Promise<void> {
		await this.repository.softDelete({
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

	async findPaginatedByUser(
		userId: UserId,
		limit: number,
		cursorCreatedAt?: Date,
		cursorBookId?: string,
	): Promise<Favorite[]> {
		const qb = this.repository
			.createQueryBuilder('favorite')
			.where('favorite.userId = :userId', { userId: userId.toString() })
			.orderBy('favorite.createdAt', 'DESC')
			.addOrderBy('favorite.bookId', 'DESC');

		if (cursorCreatedAt && cursorBookId) {
			qb.andWhere(
				'(favorite.createdAt < :cursorCreatedAt OR (favorite.createdAt = :cursorCreatedAt AND favorite.bookId < :cursorBookId))',
				{
					cursorCreatedAt,
					cursorBookId,
				},
			);
		}

		qb.take(limit + 1);

		const entities = await qb.getMany();
		return entities.map((e) => Favorite.restore(e));
	}

	async findByUserWithOffset(
		userId: UserId,
		skip: number,
		take: number,
	): Promise<[Favorite[], number]> {
		const [entities, count] = await this.repository.findAndCount({
			where: { userId: userId.toString() },
			order: { createdAt: 'DESC', bookId: 'DESC' },
			skip,
			take,
		});

		return [entities.map((e) => Favorite.restore(e)), count];
	}

	async findByUserForSync(
		userId: UserId,
		lastSyncAt?: Date,
	): Promise<Favorite[]> {
		const where: FindOptionsWhere<FavoriteEntity> = {
			userId: userId.toString(),
		};
		if (lastSyncAt) {
			where.updatedAt = MoreThanOrEqual(lastSyncAt);
		}
		const entities = await this.repository.find({
			where,
			withDeleted: !!lastSyncAt,
		});
		return entities.map((e) => Favorite.restore(e));
	}
}
