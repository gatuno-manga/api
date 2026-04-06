import { Book } from 'src/books/entities/book.entity';
import { SensitiveContent } from 'src/books/entities/sensitive-content.entity';
import { Tag } from 'src/books/entities/tags.entity';
import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { AccessPolicyEffectEnum } from '../enum/access-policy-effect.enum';
import { AccessPolicyScopeEnum } from '../enum/access-policy-scope.enum';
import { UserGroup } from './user-group.entity';
import { User } from './user.entity';

@Entity('access_policies')
export class AccessPolicy {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({
		type: 'enum',
		enum: AccessPolicyEffectEnum,
	})
	effect: AccessPolicyEffectEnum;

	@Column({
		type: 'enum',
		enum: AccessPolicyScopeEnum,
	})
	scope: AccessPolicyScopeEnum;

	@Column({ nullable: true })
	targetUserId: string | null;

	@ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'targetUserId' })
	targetUser: User | null;

	@Column({ nullable: true })
	targetGroupId: string | null;

	@ManyToOne(() => UserGroup, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'targetGroupId' })
	targetGroup: UserGroup | null;

	@Column({ nullable: true })
	bookId: string | null;

	@ManyToOne(() => Book, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'bookId' })
	book: Book | null;

	@Column({ nullable: true })
	tagId: string | null;

	@ManyToOne(() => Tag, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'tagId' })
	tag: Tag | null;

	@Column({ nullable: true })
	sensitiveContentId: string | null;

	@ManyToOne(() => SensitiveContent, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'sensitiveContentId' })
	sensitiveContent: SensitiveContent | null;

	@Column({ default: true })
	isActive: boolean;

	@Column({ type: 'int', nullable: true })
	overrideMaxWeightSensitiveContent: number | null;

	@Column({ type: 'text', nullable: true })
	reason: string | null;

	@Column({ type: 'datetime', nullable: true })
	expiresAt: Date | null;

	@Column({ nullable: true })
	createdByUserId: string | null;

	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'createdByUserId' })
	createdByUser: User | null;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
