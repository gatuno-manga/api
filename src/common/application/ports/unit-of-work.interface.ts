import { IBookRepository } from 'src/books/application/ports/book-repository.interface';
import { IChapterRepository } from 'src/books/application/ports/chapter-repository.interface';
import { IAuthorRepository } from 'src/books/application/ports/author-repository.interface';
import { ITagRepository } from 'src/books/application/ports/tag-repository.interface';
import { ISensitiveContentRepository } from 'src/books/application/ports/sensitive-content-repository.interface';

export interface IUnitOfWork {
	/**
	 * Inicia uma nova transação
	 */
	start(): Promise<void>;

	/**
	 * Commita as alterações da transação ativa
	 */
	commit(): Promise<void>;

	/**
	 * Reverte as alterações da transação ativa
	 */
	rollback(): Promise<void>;

	/**
	 * Executa uma função dentro de uma transação gerenciada
	 */
	runInTransaction<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T>;

	// Getters para Repositórios Transacionais
	getBookRepository(): IBookRepository;
	getChapterRepository(): IChapterRepository;
	getAuthorRepository(): IAuthorRepository;
	getTagRepository(): ITagRepository;
	getSensitiveContentRepository(): ISensitiveContentRepository;
}

export const I_UNIT_OF_WORK = 'IUnitOfWork';
