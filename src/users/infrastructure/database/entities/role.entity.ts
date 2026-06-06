import {
	Column,
	Entity,
	JoinTable,
	ManyToMany,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { Permission } from './permission.entity';

@Entity('roles')
export class Role {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ unique: true })
	name: string;

	@Column({ default: 0 })
	maxWeightSensitiveContent: number;

	@ManyToMany(() => Permission)
	@JoinTable({ name: 'roles_permissions' })
	permissions: Permission[];
}
