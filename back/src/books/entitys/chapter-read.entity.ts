import {
	CreateDateColumn,
	Entity,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entitys/user.entity';
import { Chapter } from 'src/books/entitys/chapter.entity';

@Entity('chapters_read')
export class ChapterRead {
	@PrimaryGeneratedColumn()
	id: number;

	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	user: User;

	@ManyToOne(() => Chapter, { onDelete: 'CASCADE' })
	chapter: Chapter;

	@CreateDateColumn()
	readAt: Date;
}
