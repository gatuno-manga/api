import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('tags')
export class Tag {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ unique: true })
	name: string;

	@Column({
		type: 'json',
		nullable: true,
	})
	altNames: { name: string; languageCode: string }[];

	@Column({
		type: 'json',
		nullable: true,
	})
	aliases: string[] | null;

	@Column({
		type: 'text',
		nullable: true,
	})
	description: string;
}
