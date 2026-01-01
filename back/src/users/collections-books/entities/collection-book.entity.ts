import {
	Column,
	CreateDateColumn,
	Entity,
	JoinTable,
	ManyToMany,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { User } from '../../entitys/user.entity';
import { Book } from 'src/books/entitys/book.entity';

@Entity('collection_book')
export class CollectionBook {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column()
	title: string;

	@Column({ type: 'text', nullable: true })
	description: string;

	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	user: User;

	@ManyToMany(() => Book)
	@JoinTable({
		name: 'collection_book_books',
		joinColumn: { name: 'collectionId', referencedColumnName: 'id' },
		inverseJoinColumn: { name: 'bookId', referencedColumnName: 'id' },
	})
	books: Book[];

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
