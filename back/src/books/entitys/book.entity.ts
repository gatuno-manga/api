import {
	Column,
	Entity,
	OneToMany,
	PrimaryGeneratedColumn,
	Relation,
} from 'typeorm';
import { Chapter } from './chapter.entity';

@Entity('books')
export class Book {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column()
	title: string;

	@Column({
		type: 'enum',
		enum: ['process', 'ready'],
		default: 'process',
	})
	scrapingStatus: string;

	@OneToMany(() => Chapter, (chapter) => chapter.book, {
		cascade: true,
	})
	chapters: Relation<Chapter[]>;
}
