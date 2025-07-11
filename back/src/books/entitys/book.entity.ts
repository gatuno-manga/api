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
import { Author } from './author.entity';

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
		type: 'set',
		enum: SensitiveContent,
		default: SensitiveContent.SAFE,
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

	@ManyToMany(() => Author, (author) => author.books, {
		cascade: true,
	})
	@JoinTable()
	authors: Relation<Author[]>

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
