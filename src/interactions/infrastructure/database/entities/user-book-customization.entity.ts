import { Book } from '@books/infrastructure/database/entities/book.entity';
import { User } from '@users/infrastructure/database/entities/user.entity';
import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
	UpdateDateColumn,
} from 'typeorm';

@Entity('user_book_customizations')
@Index('IDX_USER_BOOK_CUST', ['userId', 'bookId'])
export class UserBookCustomizationEntity {
	@PrimaryColumn()
	userId: string;

	@PrimaryColumn()
	bookId: string;

	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	user: User;

	@ManyToOne(() => Book, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'bookId' })
	book: Book;

	@Column({ type: 'varchar', length: 500, nullable: true })
	customTitle: string | null;

	@Column({ type: 'varchar', length: 1000, nullable: true })
	customCoverUrl: string | null;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
