import { BookType } from '@books/domain/enums/book-type.enum';
import { ExportFormat } from '@books/domain/enums/export-format.enum';
import { PublicationStatus } from '@books/domain/enums/publication-status.enum';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
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
import { AlternativeTitle } from './alternative-title.entity';
import { Author } from './author.entity';
import { BookDescription } from './book-description.entity';
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
@Index(['title', 'alternative_titles_text'], { fulltext: true })
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

	@OneToMany(
		() => AlternativeTitle,
		(altTitle) => altTitle.book,
		{
			cascade: true,
		},
	)
	alternativeTitles: Relation<AlternativeTitle[]>;

	@OneToMany(
		() => BookDescription,
		(desc) => desc.book,
		{ cascade: true },
	)
	localizedDescriptions: Relation<BookDescription[]>;

	@Column({
		type: 'json',
		nullable: true,
	})
	searchTerms: string[];

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

	description: string; // Transient property for legacy mapping

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
		type: 'enum',
		enum: PublicationStatus,
		default: PublicationStatus.ONGOING,
	})
	publicationStatus: PublicationStatus;

	@Column({
		type: 'boolean',
		default: false,
	})
	autoUpdate: boolean;

	@Column({
		type: 'varchar',
		length: 10,
		nullable: true,
	})
	originalLanguageCode: string | null;

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

	/**
	 * Coluna virtual (populada via triggers no MySQL) para busca FULLTEXT.
	 * Contém os títulos alternativos limpos de caracteres JSON.
	 */
	@Column({
		type: 'text',
		select: false,
		insert: false,
		update: false,
		nullable: true,
	})
	alternative_titles_text: string;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;

	@DeleteDateColumn()
	deletedAt: Date;
}
