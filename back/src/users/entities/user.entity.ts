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
import { UserGroup } from './user-group.entity';

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

	@Column({ type: 'varchar', length: 255, nullable: true })
	profileImagePath: string | null;

	@Column({ type: 'varchar', length: 255, nullable: true })
	profileBannerPath: string | null;

	@Column({ default: false })
	isBanned: boolean;

	@Column({ type: 'datetime', nullable: true })
	suspendedUntil: Date | null;

	@Column({ type: 'varchar', length: 255, nullable: true })
	suspensionReason: string | null;

	@ManyToMany(() => Role, { eager: true })
	@JoinTable({ name: 'users_roles' })
	roles: Role[];

	@ManyToMany(
		() => UserGroup,
		(group) => group.members,
		{
			eager: true,
		},
	)
	@JoinTable({ name: 'users_groups' })
	groups: UserGroup[];

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
