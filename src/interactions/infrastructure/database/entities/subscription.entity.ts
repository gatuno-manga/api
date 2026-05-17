import { Book } from '@books/infrastructure/database/entities/book.entity';
import { User } from '@users/infrastructure/database/entities/user.entity';
import {
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
} from 'typeorm';

@Entity('subscriptions')
export class SubscriptionEntity {
	@PrimaryColumn()
	userId: string;

	@PrimaryColumn()
	bookId: string;

	@ManyToOne(() => User)
	@JoinColumn({ name: 'userId' })
	user: User;

	@ManyToOne(() => Book)
	@JoinColumn({ name: 'bookId' })
	book: Book;

	@CreateDateColumn()
	createdAt: Date;
}
