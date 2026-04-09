import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	OneToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';

@Entity('auth_user_mfa')
export class UserMfa {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ type: 'varchar', length: 36, unique: true })
	userId: string;

	@OneToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	user: User;

	@Column({ type: 'text', nullable: true })
	totpSecretEncrypted: string | null;

	@Column({ type: 'boolean', default: false })
	isTotpEnabled: boolean;

	@Column({ type: 'json', nullable: true })
	backupCodesHash: string[] | null;

	@Column({ type: 'int', default: 0 })
	backupCodesUsed: number;

	@Column({ type: 'datetime', nullable: true })
	lastVerifiedAt: Date | null;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
