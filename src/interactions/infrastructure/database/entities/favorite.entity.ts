import { Book } from '@books/infrastructure/database/entities/book.entity';
import { User } from '@users/infrastructure/database/entities/user.entity';
import {
	CreateDateColumn,
	DeleteDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
	UpdateDateColumn,
} from 'typeorm';

@Entity('favorites')
@Index('IDX_FAVORITES_PAGINATION', ['userId', 'createdAt', 'bookId'])
export class FavoriteEntity {
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

	@UpdateDateColumn()
	updatedAt: Date;

	@DeleteDateColumn()
	deletedAt: Date | null;
}
