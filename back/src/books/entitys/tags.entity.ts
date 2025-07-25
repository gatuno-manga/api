import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('tags')
export class Tag {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ unique: true })
	name: string;

	@Column({
		nullable: true,
	})
	description: string;
}
