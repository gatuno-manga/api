import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from 'typeorm';
import { User } from '../../entitys/user.entity';
import { Page } from 'src/books/entitys/page.entity';
import { Chapter } from 'src/books/entitys/chapter.entity';
import { Book } from 'src/books/entitys/book.entity';

/**
 * Entity para páginas salvas/favoritas do usuário.
 * Permite que o usuário marque páginas específicas e adicione comentários.
 */
@Entity('saved_pages')
@Unique(['user', 'page']) // Um usuário só pode salvar a mesma página uma vez
export class SavedPage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @ManyToOne(() => Page, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'page_id' })
    page: Page;

    @ManyToOne(() => Chapter, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'chapter_id' })
    chapter: Chapter;

    @ManyToOne(() => Book, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'book_id' })
    book: Book;

    /**
     * Comentário opcional do usuário sobre a página salva
     */
    @Column({ type: 'text', nullable: true })
    comment: string | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
