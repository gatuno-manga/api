import {
	Column,
	CreateDateColumn,
	Entity,
	ManyToMany,
	PrimaryGeneratedColumn,
	Relation,
	UpdateDateColumn,
} from 'typeorm';
import { Book } from './book.entity';

@Entity('authors')
export class Author {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column()
	name: string;

	@Column({
		type: 'text',
		nullable: true,
	})
	biography: string | null;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;

	@ManyToMany(
		() => Book,
		(book) => book.authors,
	)
	books: Relation<Book[]>;
}
