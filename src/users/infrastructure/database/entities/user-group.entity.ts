import {
	Column,
	CreateDateColumn,
	Entity,
	ManyToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_groups')
export class UserGroup {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ unique: true })
	name: string;

	@Column({ type: 'varchar', length: 255, nullable: true })
	description: string | null;

	@Column({ default: 4 })
	defaultMaxWeightSensitiveContent: number;

	@ManyToMany(
		() => User,
		(user) => user.groups,
	)
	members: User[];

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
