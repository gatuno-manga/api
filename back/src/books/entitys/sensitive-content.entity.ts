import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Book } from './book.entity';

@Entity('sensitive_content')
export class SensitiveContent {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    name: string;

    @Column({
        type: 'json',
        nullable: true,
    })
    altNames: string[];

    @Column({
        type: 'int',
        default: 0,
        unsigned: true,
    })
    weight: number;
}
