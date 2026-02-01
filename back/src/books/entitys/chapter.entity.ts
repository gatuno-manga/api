import {
	Column,
	Entity,
	JoinColumn,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
	Relation,
	Unique,
	DeleteDateColumn,
} from 'typeorm';
import { Book } from './book.entity';
import { Page } from './page.entity';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';
import { ContentType } from '../enum/content-type.enum';
import { ContentFormat } from '../enum/content-format.enum';
import { DocumentFormat } from '../enum/document-format.enum';

@Entity('chapters')
@Unique(['index', 'book'])
export class Chapter {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({
		nullable: true,
	})
	title: string;

	@Column({ nullable: true })
	originalUrl: string;

	@Column({ type: 'decimal', precision: 15, scale: 3 })
	index: number;

	/**
	 * Tipo de conteúdo do capítulo
	 * - IMAGE: Páginas de imagem (mangás) - usa relação 'pages'
	 * - TEXT: Texto (novels) - usa campo 'content'
	 * - DOCUMENT: Arquivo (PDF/EPUB) - usa campo 'documentPath'
	 */
	@Column({
		type: 'enum',
		enum: ContentType,
		default: ContentType.IMAGE,
	})
	contentType: ContentType;

	/**
	 * Conteúdo textual do capítulo (usado quando contentType = TEXT)
	 * Suporta Markdown, HTML ou texto puro
	 */
	@Column({
		type: 'longtext',
		nullable: true,
	})
	content: string | null;

	/**
	 * Formato do conteúdo textual (MARKDOWN, HTML, PLAIN)
	 */
	@Column({
		type: 'enum',
		enum: ContentFormat,
		nullable: true,
	})
	contentFormat: ContentFormat | null;

	/**
	 * Caminho do arquivo de documento (usado quando contentType = DOCUMENT)
	 * Armazena PDFs, EPUBs, etc.
	 */
	@Column({
		type: 'varchar',
		length: 500,
		nullable: true,
	})
	documentPath: string | null;

	/**
	 * Formato do documento (PDF, EPUB)
	 */
	@Column({
		type: 'enum',
		enum: DocumentFormat,
		nullable: true,
	})
	documentFormat: DocumentFormat | null;

	@Column({
		type: 'enum',
		enum: ScrapingStatus,
		nullable: true,
		default: null,
	})
	scrapingStatus: ScrapingStatus | null;

	@Column({
		default: 0,
	})
	retries: number;

	@ManyToOne(() => Book, {
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'bookId' })
	book: Relation<Book>;

	@OneToMany(() => Page, (page) => page.chapter, { cascade: true })
	pages: Relation<Page[]>;

	@Column({
		type: 'boolean',
		default: false,
	})
	isFinal: boolean;

	@DeleteDateColumn()
	deletedAt: Date;
}
