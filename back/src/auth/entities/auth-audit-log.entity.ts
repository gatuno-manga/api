import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { AuthMethod, AuthRiskLevel } from '../types/auth-security.types';

@Entity('auth_audit_logs')
@Index(['userId', 'createdAt'])
@Index(['event', 'createdAt'])
export class AuthAuditLog {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ type: 'varchar', length: 36, nullable: true })
	userId: string | null;

	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'userId' })
	user: User | null;

	@Column({ type: 'varchar', length: 80 })
	event: string;

	@Column({ type: 'boolean', default: true })
	success: boolean;

	@Column({ type: 'varchar', length: 64, nullable: true })
	sessionId: string | null;

	@Column({ type: 'varchar', length: 32, nullable: true })
	authMethod: AuthMethod | null;

	@Column({ type: 'varchar', length: 16, nullable: true })
	riskLevel: AuthRiskLevel | null;

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

	@Column({ type: 'json', nullable: true })
	metadata: Record<string, unknown> | null;

	@CreateDateColumn()
	createdAt: Date;
}
