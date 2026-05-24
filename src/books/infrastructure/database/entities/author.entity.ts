import {
	Column,
	CreateDateColumn,
	Entity,
	ManyToMany,
	OneToMany,
	PrimaryGeneratedColumn,
	Relation,
	UpdateDateColumn,
} from 'typeorm';
import { AuthorBiography } from './author-biography.entity';
import { Book } from './book.entity';

@Entity('authors')
export class Author {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column()
	name: string;

	@OneToMany(
		() => AuthorBiography,
		(bio) => bio.author,
		{ cascade: true },
	)
	localizedBiographies: Relation<AuthorBiography[]>;

	biography: string | null; // Transient for legacy mapping

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
