import { Column, CreateDateColumn, Entity, ManyToMany, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { User } from "./user.entity";
import { Book } from "src/books/entitys/book.entity";

@Entity('coletion_book')
export class ColectionBook {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    user: User;

    @ManyToMany(() => Book, { onDelete: 'CASCADE' })
    books: Book[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
