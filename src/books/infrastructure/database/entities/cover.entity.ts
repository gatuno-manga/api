import {
	Column,
	DeleteDateColumn,
	Entity,
	Index,
	ManyToOne,
	PrimaryGeneratedColumn,
	Relation,
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

	@Column({ nullable: true })
	@Index()
	imageHash: string;

	@Column({ nullable: true })
	originalUrl: string;

	@Column({ default: false })
	selected: boolean;

	@ManyToOne(
		() => Book,
		(book) => book.covers,
		{ onDelete: 'CASCADE' },
	)
	book: Relation<Book>;

	@DeleteDateColumn()
	deletedAt: Date;
}
