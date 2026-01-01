import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('reading_progress')
@Index(['userId', 'chapterId'], { unique: true })
export class ReadingProgress {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column('uuid')
	userId: string;

	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	user: User;

	@Column('uuid')
	chapterId: string;

	@Column('uuid')
	bookId: string;

	@Column({ type: 'int', default: 0 })
	pageIndex: number;

	@Column({ type: 'int', default: 0 })
	totalPages: number;

	@Column({ type: 'boolean', default: false })
	completed: boolean;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
