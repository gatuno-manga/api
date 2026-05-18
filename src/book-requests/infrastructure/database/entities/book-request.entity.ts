import { BookRequestStatus } from '@/book-requests/domain/enums/book-request-status.enum';
import { User } from '@users/infrastructure/database/entities/user.entity';
import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

@Entity('book_requests')
export class BookRequestEntity {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ name: 'user_id' })
	userId: string;

	@ManyToOne(() => User)
	@JoinColumn({ name: 'user_id' })
	user: User;

	@Column()
	title: string;

	@Column()
	url: string;

	@Column({ type: 'text', nullable: true })
	reason: string | null;

	@Column({
		type: 'enum',
		enum: BookRequestStatus,
		default: BookRequestStatus.PENDING,
	})
	status: BookRequestStatus;

	@Column({ name: 'admin_id', type: 'varchar', length: 36, nullable: true })
	adminId: string | null;

	@ManyToOne(() => User, { nullable: true })
	@JoinColumn({ name: 'admin_id' })
	admin: User | null;

	@Column({ name: 'rejection_message', type: 'text', nullable: true })
	rejectionMessage: string | null;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
