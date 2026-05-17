import { Book } from '@books/infrastructure/database/entities/book.entity';
import { User } from '@users/infrastructure/database/entities/user.entity';
import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
	UpdateDateColumn,
} from 'typeorm';

@Entity('reviews')
export class ReviewEntity {
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

	@Column({ type: 'int' })
	rating: number;

	@Column({ type: 'text' })
	content: string;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
