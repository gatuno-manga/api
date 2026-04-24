import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

@Entity('user_images')
export class UserImage {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column()
	path: string;

	@Column({ nullable: true })
	width: number;

	@Column({ nullable: true })
	height: number;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
