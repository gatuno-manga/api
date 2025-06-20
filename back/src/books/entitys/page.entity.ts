import {
	Column,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
	Relation,
	Unique,
} from 'typeorm';
import { Chapter } from './chapter.entity';

@Entity('pages')
@Unique(['index', 'chapter'])
export class Page {
	@PrimaryColumn()
	index: number;

	@ManyToOne(() => Chapter, {
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'chapterId' })
	chapter: Relation<Chapter>;

	@Column()
	path: string;
}
