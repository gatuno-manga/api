import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('web_push_subscriptions')
export class WebPushSubscription {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column()
	userId: string;

	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	user: User;

	@Column({ type: 'text' })
	endpoint: string;

	@Column({ type: 'varchar', length: 255 })
	p256dh: string;

	@Column({ type: 'varchar', length: 255 })
	auth: string;

	@Column({ type: 'varchar', length: 255, nullable: true })
	deviceAgent: string | null;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
