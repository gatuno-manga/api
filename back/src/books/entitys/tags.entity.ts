import { Column, Entity, PrimaryColumn, Relation } from 'typeorm';

@Entity('tags')
export class Tag {
	@PrimaryColumn()
	name: string;

	@Column({
		nullable: true,
	})
	description: string;
}
