import { Chapter } from 'src/books/entities/chapter.entity';
import { User } from 'src/users/entities/user.entity';
import {
	Column,
	CreateDateColumn,
	DeleteDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
	Relation,
	UpdateDateColumn,
} from 'typeorm';

@Entity('chapter_comments')
export class ChapterComment {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@ManyToOne(() => Chapter, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'chapter_id' })
	chapter: Relation<Chapter>;

	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_id' })
	user: Relation<User>;

	@Column({ name: 'user_name', type: 'varchar', length: 255 })
	userName: string;

	@ManyToOne(
		() => ChapterComment,
		(comment) => comment.replies,
		{
			nullable: true,
			onDelete: 'CASCADE',
		},
	)
	@JoinColumn({ name: 'parent_id' })
	parent: Relation<ChapterComment | null>;

	@OneToMany(
		() => ChapterComment,
		(comment) => comment.parent,
	)
	replies: Relation<ChapterComment[]>;

	@Column({ type: 'text' })
	content: string;

	@Column({ default: true })
	isPublic: boolean;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;

	@DeleteDateColumn()
	deletedAt: Date | null;
}
