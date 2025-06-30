import {
	Column,
	CreateDateColumn,
	Entity,
	JoinTable,
	ManyToMany,
	OneToMany,
	PrimaryGeneratedColumn,
	Relation,
	UpdateDateColumn,
} from 'typeorm';
import { Chapter } from './chapter.entity';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';
import { Tag } from './tags.entity';
import { BookType } from '../enum/book-type.enum';
import { SensitiveContent } from '../enum/sensitive-content.enum';

@Entity('books')
export class Book {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column()
	title: string;

	@Column({
		nullable: true,
	})
	cover: string;

	@Column({
		type: 'json',
		nullable: true,
	})
	alternativeTitle: string[];

	@Column({
		type: 'enum',
		enum: BookType,
		default: BookType.BOOK,
	})
	type: BookType;

	@Column({
		type: 'json',
		nullable: true,
	})
	sensitiveContent: SensitiveContent[];

	@Column({
		type: 'json',
		nullable: true,
	})
	originalUrl: string[];

	@Column({
		type: 'text',
		nullable: true,
	})
	description: string;

	@Column({
		nullable: true,
	})
	coverUrl: string;

	@Column({
		nullable: true,
	})
	publication: number;

	@Column({
		type: 'enum',
		enum: ScrapingStatus,
		default: ScrapingStatus.READY,
	})
	scrapingStatus: ScrapingStatus;

	@OneToMany(() => Chapter, (chapter) => chapter.book, {
		cascade: true,
	})
	chapters: Relation<Chapter[]>;

	@ManyToMany(() => Tag)
	@JoinTable()
	tags: Relation<Tag[]>;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
