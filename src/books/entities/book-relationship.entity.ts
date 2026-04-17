import {
	Check,
	Column,
	CreateDateColumn,
	DeleteDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	Relation,
	UpdateDateColumn,
} from 'typeorm';
import { BookRelationType } from '../enum/book-relation-type.enum';
import { Book } from './book.entity';

export type BookRelationshipMetadata = {
	note?: string;
	weight?: number;
};

@Entity('book_relationships')
@Index(['sourceBookId'])
@Index(['targetBookId'])
@Index(['relationType'])
@Index(['deletedAt'])
@Index(['sourceBookId', 'targetBookId', 'relationType'], { unique: true })
@Check('"sourceBookId" <> "targetBookId"')
export class BookRelationship {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ type: 'char', length: 36 })
	sourceBookId!: string;

	@Column({ type: 'char', length: 36 })
	targetBookId!: string;

	@Column({
		type: 'enum',
		enum: BookRelationType,
	})
	relationType!: BookRelationType;

	@Column({
		type: 'boolean',
		default: false,
	})
	isBidirectional!: boolean;

	@Column({
		type: 'int',
		nullable: true,
	})
	order!: number | null;

	@Column({
		type: 'json',
		nullable: true,
	})
	metadata!: BookRelationshipMetadata | null;

	@ManyToOne(() => Book, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'sourceBookId' })
	sourceBook!: Relation<Book>;

	@ManyToOne(() => Book, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'targetBookId' })
	targetBook!: Relation<Book>;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;

	@DeleteDateColumn()
	deletedAt!: Date | null;
}
