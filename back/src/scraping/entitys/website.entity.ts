import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

@Entity('websites')
export class Website {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column()
	url: string;

	@Column({
		type: 'text',
		nullable: true,
	})
	preScript: string;

	@Column({
		type: 'text',
		nullable: true,
	})
	posScript: string;

	@Column({
		type: 'text',
	})
	selector: string;

	@Column({
		type: 'json',
		nullable: true,
	})
	ignoreFiles: string[];

	@Column({
		type: 'int',
		nullable: true,
	})
	concurrencyLimit: number | null;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
