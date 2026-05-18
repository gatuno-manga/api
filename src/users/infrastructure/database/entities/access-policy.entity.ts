import { AccessPolicyEffectEnum } from '@users/domain/enums/access-policy-effect.enum';
import { AccessPolicyScopeEnum } from '@users/domain/enums/access-policy-scope.enum';
import { Book } from 'src/books/infrastructure/database/entities/book.entity';
import { SensitiveContent } from 'src/books/infrastructure/database/entities/sensitive-content.entity';
import { Tag } from 'src/books/infrastructure/database/entities/tags.entity';
import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
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

	@Column({ type: 'varchar', length: 36, nullable: true })
	targetUserId: string | null;

	@ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'targetUserId' })
	targetUser: User | null;

	@Column({ type: 'varchar', length: 36, nullable: true })
	targetGroupId: string | null;

	@ManyToOne(() => UserGroup, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'targetGroupId' })
	targetGroup: UserGroup | null;

	@Column({ type: 'varchar', length: 36, nullable: true })
	bookId: string | null;

	@ManyToOne(() => Book, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'bookId' })
	book: Book | null;

	@Column({ type: 'varchar', length: 36, nullable: true })
	tagId: string | null;

	@ManyToOne(() => Tag, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'tagId' })
	tag: Tag | null;

	@Column({ type: 'varchar', length: 36, nullable: true })
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

	@Column({ type: 'varchar', length: 36, nullable: true })
	createdByUserId: string | null;

	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'createdByUserId' })
	createdByUser: User | null;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
