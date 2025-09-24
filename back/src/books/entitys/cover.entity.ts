import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Relation } from "typeorm";
import { Book } from "./book.entity";

@Entity('covers')
export class Cover {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    url: string;

    @Column()
    title: string;

    @Column({ default: false })
    selected: boolean;

    @ManyToOne(() => Book, (book) => book.covers, { onDelete: 'CASCADE' })
    book: Relation<Book>;
}
