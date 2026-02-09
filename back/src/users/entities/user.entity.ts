import {
	Column,
	CreateDateColumn,
	Entity,
	JoinTable,
	ManyToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { Role } from './role.entity';

@Entity('users')
export class User {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column()
	userName: string;

	@Column({ nullable: true })
	name: string;

	@Column({ unique: true })
	email: string;

	@Column({
		select: false,
	})
	password: string;

	@Column({ default: 0 })
	maxWeightSensitiveContent: number;

	@ManyToMany(() => Role, { eager: true })
	@JoinTable({ name: 'users_roles' })
	roles: Role[];

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
