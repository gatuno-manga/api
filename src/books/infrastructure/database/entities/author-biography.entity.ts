import {
	Column,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	Relation,
} from 'typeorm';
import { Author } from './author.entity';

@Entity('author_biographies')
export class AuthorBiography {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ type: 'text' })
	biography: string;

	@Column({ type: 'varchar', length: 10 })
	languageCode: string;

	@Column({ type: 'int', default: 0 })
	rank: number;

	@Column({ type: 'char', length: 36 })
	authorId: string;

	@ManyToOne(
		() => Author,
		(author) => author.localizedBiographies,
		{ onDelete: 'CASCADE' },
	)
	@JoinColumn({ name: 'authorId' })
	author: Relation<Author>;
}
