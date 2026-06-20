import { Book } from '@books/infrastructure/database/entities/book.entity';
import { User } from '@users/infrastructure/database/entities/user.entity';
import {
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
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
}
