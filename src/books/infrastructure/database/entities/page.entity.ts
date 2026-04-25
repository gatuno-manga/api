import {
	Column,
	DeleteDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	Relation,
	Unique,
} from 'typeorm';
import { Chapter } from './chapter.entity';
import { ImageMetadata } from 'src/common/domain/value-objects/image-metadata.vo';

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

	@DeleteDateColumn()
	deletedAt: Date;
}
