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
import { ScrapingStatus } from '../enum/scrapingStatus.enum';

@Entity('chapters')
@Unique(['index', 'book'])
export class Chapter {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({
		nullable: true,
	})
	title: string;

	@Column()
	originalUrl: string;

	@Column({ type: 'decimal', precision: 15, scale: 3 })
	index: number;

	@Column({
		type: 'enum',
		enum: ScrapingStatus,
		default: ScrapingStatus.PROCESS,
	})
	scrapingStatus: ScrapingStatus;

	@ManyToOne(() => Book, {
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'bookId' })
	book: Relation<Book>;

	@OneToMany(() => Page, (page) => page.chapter, { cascade: true })
	pages: Relation<Page[]>;
}
