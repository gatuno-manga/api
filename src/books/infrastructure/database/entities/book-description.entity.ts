import {
	Column,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	Relation,
} from 'typeorm';
import { Book } from './book.entity';

@Entity('book_descriptions')
export class BookDescription {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ type: 'text' })
	description: string;

	@Column({ type: 'varchar', length: 10 })
	languageCode: string;

	@Column({ type: 'int', default: 0 })
	rank: number;

	@Column({ type: 'char', length: 36 })
	bookId: string;

	@ManyToOne(
		() => Book,
		(book) => book.localizedDescriptions,
		{ onDelete: 'CASCADE' },
	)
	@JoinColumn({ name: 'bookId' })
	book: Relation<Book>;
}
