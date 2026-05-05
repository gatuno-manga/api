import {
	Entity,
	PrimaryColumn,
	CreateDateColumn,
	ManyToOne,
	JoinColumn,
} from 'typeorm';
import { User } from '@users/infrastructure/database/entities/user.entity';
import { Book } from '@books/infrastructure/database/entities/book.entity';

@Entity('favorites')
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
