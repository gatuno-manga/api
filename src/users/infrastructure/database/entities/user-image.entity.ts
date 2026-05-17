import { ImageMetadata } from 'src/common/domain/value-objects/image-metadata.vo';
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

	@Column({ type: 'json', nullable: true })
	metadata: ImageMetadata | null;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
