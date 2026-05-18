import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { ImageMetadata } from 'src/common/domain/value-objects/image-metadata.vo';
import {
	Column,
	CreateDateColumn,
	DeleteDateColumn,
	Entity,
	Index,
	ManyToOne,
	PrimaryGeneratedColumn,
	Relation,
	UpdateDateColumn,
} from 'typeorm';
import { Book } from './book.entity';

@Entity('covers')
export class Cover {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column()
	url: string;

	@Column()
	title: string;

	@Column({ default: 0 })
	index: number;

	@Column({ type: 'json', nullable: true })
	metadata: ImageMetadata | null;

	@Column({ nullable: true })
	@Index()
	imageHash: string;

	@Column({ nullable: true })
	originalUrl: string;

	@Column({ default: false })
	selected: boolean;

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

	@ManyToOne(
		() => Book,
		(book) => book.covers,
		{ onDelete: 'CASCADE' },
	)
	book: Relation<Book>;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;

	@DeleteDateColumn()
	deletedAt: Date;
}
