import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	JoinTable,
	ManyToMany,
	OneToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { Role } from './role.entity';
import { UserGroup } from './user-group.entity';
import { UserImage } from './user-image.entity';

@Entity('users')
export class User {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column()
	userName: string;

	@Column({ type: 'varchar', length: 255, nullable: true })
	name: string | null;

	@Column({ unique: true })
	email: string;

	@Column({
		type: 'varchar',
		length: 255,
		select: false,
		nullable: true,
	})
	password: string | null;

	@Column({ type: 'varchar', length: 255, nullable: true, unique: true })
	googleId: string | null;

	@Column({ type: 'varchar', length: 255, nullable: true, unique: true })
	discordId: string | null;

	@Column({ type: 'varchar', length: 255, nullable: true, unique: true })
	githubId: string | null;

	@Column({ default: 0 })
	maxWeightSensitiveContent: number;

	@OneToOne(() => UserImage, { nullable: true, cascade: true, eager: true })
	@JoinColumn({ name: 'profilePictureId' })
	profilePicture: UserImage | null;

	@OneToOne(() => UserImage, { nullable: true, cascade: true, eager: true })
	@JoinColumn({ name: 'profileBannerId' })
	profileBanner: UserImage | null;

	@Column({ default: false })
	isBanned: boolean;

	@Column({ type: 'datetime', nullable: true })
	suspendedUntil: Date | null;

	@Column({ type: 'varchar', length: 255, nullable: true })
	suspensionReason: string | null;

	@Column({ type: 'varchar', length: 10, default: 'pt-BR' })
	preferredLanguage: string;

	@Column({ type: 'json', nullable: true })
	preferences: Record<string, unknown> = {};

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
