import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('sensitive_content')
export class SensitiveContent {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ unique: true })
	name: string;

	@Column({
		type: 'json',
		nullable: true,
	})
	altNames: string[];

	@Column({
		type: 'int',
		default: 0,
		unsigned: true,
	})
	weight: number;
}
