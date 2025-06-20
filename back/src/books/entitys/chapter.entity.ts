import {
	Column,
	Entity,
	JoinColumn,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
	Relation,
	Unique,
} from 'typeorm';
import { Book } from './book.entity';
import { Page } from './page.entity';

@Entity('chapters')
@Unique(['index', 'book'])
export class Chapter {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column()
	title: string;

	@Column()
	originalUrl: string;

	@Column()
	index: number;

	@ManyToOne(() => Book, {
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'bookId' })
	book: Relation<Book>;

	@OneToMany(() => Page, (page) => page.chapter, { cascade: true })
	pages: Relation<Page[]>;
}
