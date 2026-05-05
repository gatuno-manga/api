import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionRepository } from '@/interactions/application/ports/subscription-repository.port';
import { Subscription } from '@/interactions/domain/entities/subscription';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { BookId } from '@common/domain/value-objects/book-id.vo';
import { SubscriptionEntity } from '@/interactions/infrastructure/database/entities/subscription.entity';

@Injectable()
export class TypeOrmSubscriptionRepository implements SubscriptionRepository {
	constructor(
		@InjectRepository(SubscriptionEntity)
		private readonly repository: Repository<SubscriptionEntity>,
	) {}

	async save(subscription: Subscription): Promise<void> {
		const snapshot = subscription.toSnapshot();
		const entity = this.repository.create(snapshot);
		await this.repository.save(entity);
	}

	async delete(userId: UserId, bookId: BookId): Promise<void> {
		await this.repository.delete({
			userId: userId.toString(),
			bookId: bookId.toString(),
		});
	}

	async isSubscribed(userId: UserId, bookId: BookId): Promise<boolean> {
		const count = await this.repository.count({
			where: { userId: userId.toString(), bookId: bookId.toString() },
		});
		return count > 0;
	}

	async findByBook(bookId: BookId): Promise<Subscription[]> {
		const entities = await this.repository.find({
			where: { bookId: bookId.toString() },
		});
		return entities.map((e) => Subscription.restore(e));
	}
}
