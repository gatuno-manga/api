import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewRepository } from '../../../application/ports/review-repository.port';
import { Review } from '../../../domain/entities/review';
import { UserId } from '../../../../common/domain/value-objects/user-id.vo';
import { BookId } from '../../../../common/domain/value-objects/book-id.vo';
import { ReviewEntity } from '../entities/review.entity';

@Injectable()
export class TypeOrmReviewRepository implements ReviewRepository {
	constructor(
		@InjectRepository(ReviewEntity)
		private readonly repository: Repository<ReviewEntity>,
	) {}

	async save(review: Review): Promise<void> {
		const snapshot = review.toSnapshot();
		const entity = this.repository.create(snapshot);
		await this.repository.save(entity);
	}

	async findById(userId: UserId, bookId: BookId): Promise<Review | null> {
		const entity = await this.repository.findOne({
			where: { userId: userId.toString(), bookId: bookId.toString() },
		});
		return entity ? Review.restore(entity) : null;
	}

	async findByBook(bookId: BookId): Promise<Review[]> {
		const entities = await this.repository.find({
			where: { bookId: bookId.toString() },
		});
		return entities.map((e) => Review.restore(e));
	}

	async delete(userId: UserId, bookId: BookId): Promise<void> {
		await this.repository.delete({
			userId: userId.toString(),
			bookId: bookId.toString(),
		});
	}
}
