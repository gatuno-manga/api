import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
	UpdateDateColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { AuthMethod, AuthRiskLevel } from '../types/auth-security.types';

@Entity('auth_sessions')
@Index(['userId', 'revokedAt'])
@Index(['userId', 'sessionFingerprint'])
export class AuthSession {
	@PrimaryColumn({ type: 'varchar', length: 64 })
	id: string;

	@Column({ type: 'varchar', length: 36 })
	userId: string;

	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	user: User;

	@Index({ unique: true })
	@Column({ type: 'varchar', length: 120 })
	refreshTokenJti: string;

	@Column({ type: 'varchar', length: 120, nullable: true })
	refreshTokenFamilyId: string | null;

	@Column({ type: 'varchar', length: 255, nullable: true })
	sessionFingerprint: string | null;

	@Column({ type: 'varchar', length: 120, nullable: true })
	deviceId: string | null;

	@Column({ type: 'varchar', length: 255, nullable: true })
	deviceLabel: string | null;

	@Column({ type: 'varchar', length: 64, nullable: true })
	clientPlatform: string | null;

	@Column({ type: 'varchar', length: 64, nullable: true })
	ipAddress: string | null;

	@Column({ type: 'varchar', length: 1024, nullable: true })
	userAgent: string | null;

	@Column({ type: 'varchar', length: 32, default: 'password' })
	authMethod: AuthMethod;

	@Column({ type: 'boolean', default: false })
	mfaVerified: boolean;

	@Column({ type: 'varchar', length: 16, default: 'low' })
	riskLevel: AuthRiskLevel;

	@Column({ type: 'datetime', nullable: true })
	revokedAt: Date | null;

	@Column({ type: 'varchar', length: 255, nullable: true })
	revokeReason: string | null;

	@Column({ type: 'datetime' })
	lastSeenAt: Date;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
