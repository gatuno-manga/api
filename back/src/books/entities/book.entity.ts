import {
	Check,
	Column,
	CreateDateColumn,
	DeleteDateColumn,
	Entity,
	Index,
	JoinTable,
	ManyToMany,
	OneToMany,
	PrimaryGeneratedColumn,
	Relation,
	UpdateDateColumn,
} from 'typeorm';
import { BookType } from '../enum/book-type.enum';
import { ExportFormat } from '../enum/export-format.enum';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';
import { Author } from './author.entity';
import { Chapter } from './chapter.entity';
import { Cover } from './cover.entity';
import { SensitiveContent } from './sensitive-content.entity';
import { Tag } from './tags.entity';

@Entity('books')
@Index(['title'])
@Index(['type'])
@Index(['scrapingStatus'])
@Index(['createdAt'])
@Index(['deletedAt'])
@Check(
	`"publication" IS NULL OR ("publication" >= 1980 AND "publication" <= ${new Date().getFullYear() + 2})`,
)
export class Book {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ length: 500 })
	title: string;

	@OneToMany(
		() => Cover,
		(cover) => cover.book,
		{ cascade: true },
	)
	covers: Relation<Cover[]>;

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

	@ManyToMany(() => SensitiveContent)
	@JoinTable()
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
	publication: number;

	@Column({
		type: 'enum',
		enum: ScrapingStatus,
		default: ScrapingStatus.READY,
	})
	scrapingStatus: ScrapingStatus;

	@Column({
		type: 'boolean',
		default: false,
	})
	autoUpdate: boolean;

	/**
	 * Formatos de exportação disponíveis para este livro
	 * Atualizado automaticamente quando capítulos são adicionados
	 * Ex: ['pdf', 'zip'] para mangás, ['markdown', 'pdf'] para novels
	 */
	@Column({
		type: 'simple-array',
		nullable: true,
		default: null,
	})
	availableFormats: ExportFormat[];

	@OneToMany(
		() => Chapter,
		(chapter) => chapter.book,
		{
			cascade: true,
		},
	)
	chapters: Relation<Chapter[]>;

	@ManyToMany(() => Tag)
	@JoinTable()
	tags: Relation<Tag[]>;

	@ManyToMany(
		() => Author,
		(author) => author.books,
		{
			cascade: true,
		},
	)
	@JoinTable()
	authors: Relation<Author[]>;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;

	@DeleteDateColumn()
	deletedAt: Date;
}
