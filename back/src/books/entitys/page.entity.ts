import {
	Column,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	Relation,
	Unique,
	DeleteDateColumn,
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

	@DeleteDateColumn()
	deletedAt: Date;
}
