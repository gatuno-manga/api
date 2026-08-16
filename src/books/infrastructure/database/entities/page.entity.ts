import { ImageMetadata } from 'src/common/domain/value-objects/image-metadata.vo';
import {
	Column,
	DeleteDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	Relation,
	Unique,
	UpdateDateColumn,
} from 'typeorm';
import { Chapter } from './chapter.entity';

@Entity('pages')
@Unique(['index', 'chapter'])
export class Page {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	index: number;

	@ManyToOne(() => Chapter, {
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'chapterId' })
	chapter: Relation<Chapter>;

	@Column()
	path: string;

	@Column({ type: 'json', nullable: true })
	metadata: ImageMetadata | null;

	@UpdateDateColumn()
	updatedAt: Date;

	@DeleteDateColumn()
	deletedAt: Date;
}
