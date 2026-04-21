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

@Entity('auth_webauthn_credentials')
@Index(['userId', 'createdAt'])
export class WebAuthnCredential {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ type: 'varchar', length: 36 })
	userId: string;

	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	user: User;

	@Index({ unique: true })
	@Column({ type: 'varchar', length: 512 })
	credentialId: string;

	@Column({ type: 'text' })
	publicKey: string;

	@Column({ type: 'int', default: 0 })
	counter: number;

	@Column({ type: 'simple-array', nullable: true })
	transports: string[] | null;

	@Column({ type: 'varchar', length: 64, nullable: true })
	deviceType: string | null;

	@Column({ type: 'boolean', default: false })
	backedUp: boolean;

	@Column({ type: 'varchar', length: 255, nullable: true })
	name: string | null;

	@Column({ type: 'datetime', nullable: true })
	lastUsedAt: Date | null;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
