import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Relation, DeleteDateColumn, Index } from "typeorm";
import { Book } from "./book.entity";

@Entity('covers')
export class Cover {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    url: string;

    @Column()
    title: string;

    /**
     * Hash da imagem para deduplicação.
     * Calculado a partir do conteúdo da imagem (ex: SHA-256 ou perceptual hash).
     */
    @Column({ nullable: true })
    @Index()
    imageHash: string;

    /**
     * URL original de onde a capa foi baixada (antes de ser salva localmente)
     */
    @Column({ nullable: true })
    originalUrl: string;

    @Column({ default: false })
    selected: boolean;

    @ManyToOne(() => Book, (book) => book.covers, { onDelete: 'CASCADE' })
    book: Relation<Book>;

    @DeleteDateColumn()
    deletedAt: Date;
}
