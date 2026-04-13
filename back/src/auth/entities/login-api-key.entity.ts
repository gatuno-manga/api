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
import { User } from 'src/users/entities/user.entity';

@Entity('auth_login_api_keys')
@Index(['userId', 'expiresAt'])
@Index(['createdByUserId', 'createdAt'])
export class LoginApiKey {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ type: 'varchar', length: 36 })
	userId: string;

	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	user: User;

	@Column({ type: 'varchar', length: 255 })
	keyHash: string;

	@Column({ type: 'boolean', default: false })
	singleUse: boolean;

	@Column({ type: 'datetime' })
	expiresAt: Date;

	@Column({ type: 'datetime', nullable: true })
	usedAt: Date | null;

	@Column({ type: 'datetime', nullable: true })
	lastUsedAt: Date | null;

	@Column({ type: 'datetime', nullable: true })
	revokedAt: Date | null;

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
