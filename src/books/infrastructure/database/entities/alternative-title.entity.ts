import {
	Column,
	Entity,
	ManyToOne,
	PrimaryGeneratedColumn,
	Relation,
} from 'typeorm';
import { Book } from './book.entity';

@Entity('alternative_titles')
export class AlternativeTitle {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ length: 500 })
	title: string;

	@Column({ type: 'varchar', length: 10, nullable: true })
	languageCode: string | null;

	@Column({ type: 'int', default: 0 })
	rank: number;

	@ManyToOne(
		() => Book,
		(book) => book.alternativeTitles,
		{
			onDelete: 'CASCADE',
		},
	)
	book: Relation<Book>;
}
