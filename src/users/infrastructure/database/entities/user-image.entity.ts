import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { ImageMetadata } from 'src/common/domain/value-objects/image-metadata.vo';

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
