import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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
	altNames: { name: string; languageCode: string }[] | null;

	@Column({
		type: 'json',
		nullable: true,
	})
	aliases: string[] | null;

	@Column({
		type: 'int',
		default: 0,
		unsigned: true,
	})
	weight: number;
}
