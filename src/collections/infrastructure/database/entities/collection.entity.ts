import {
	Column,
	CreateDateColumn,
	Entity,
	JoinTable,
	ManyToMany,
	ManyToOne,
	PrimaryColumn,
	UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../../users/infrastructure/database/entities/user.entity';
import { Book } from '../../../../books/infrastructure/database/entities/book.entity';

@Entity('collections')
export class CollectionEntity {
	@PrimaryColumn('varchar', { length: 36 })
	id: string;

	@Column()
	title: string;

	@Column({ type: 'text', nullable: true })
	description: string | null;

	@Column({ type: 'enum', enum: ['PRIVATE', 'PUBLIC', 'SHARED'] })
	visibility: string;

	@ManyToOne(() => User)
	owner: User;

	@Column({ name: 'userId' }) // Mapping to existing column from collection_book
	ownerId: string;

	@ManyToMany(() => User)
	@JoinTable({
		name: 'collection_collaborators',
		joinColumn: { name: 'collectionId', referencedColumnName: 'id' },
		inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
	})
	collaborators: User[];

	@ManyToMany(() => Book)
	@JoinTable({
		name: 'collection_books_relation',
		joinColumn: { name: 'collectionId', referencedColumnName: 'id' },
		inverseJoinColumn: { name: 'bookId', referencedColumnName: 'id' },
	})
	books: Book[];

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
