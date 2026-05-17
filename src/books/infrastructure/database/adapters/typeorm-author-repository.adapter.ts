import { IAuthorRepository } from '@books/application/ports/author-repository.interface';
import { Author as DomainAuthor } from '@books/domain/entities/author';
import { Author as InfrastructureAuthor } from '@books/infrastructure/database/entities/author.entity';
import { Book as InfrastructureBook } from '@books/infrastructure/database/entities/book.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';

interface RawAuthorResult {
	author_id: string;
	author_name: string;
	book_id: string;
}

@Injectable()
export class TypeOrmAuthorRepositoryAdapter implements IAuthorRepository {
	private readonly repository: Repository<InfrastructureAuthor>;
	private readonly bookRepository: Repository<InfrastructureBook>;

	constructor(
		@InjectRepository(InfrastructureAuthor)
		repository: Repository<InfrastructureAuthor>,
		@InjectRepository(InfrastructureBook)
		bookRepository: Repository<InfrastructureBook>,
	) {
		this.repository = repository;
		this.bookRepository = bookRepository;
	}

	async findById(id: string): Promise<DomainAuthor | null> {
		const author = await this.repository.findOne({ where: { id } });
		if (!author) return null;
		const domainAuthor = new DomainAuthor();
		Object.assign(domainAuthor, author);
		return domainAuthor;
	}

	async save(author: DomainAuthor): Promise<DomainAuthor> {
		const entity = this.repository.create();
		Object.assign(entity, author);
		const saved = await this.repository.save(entity);
		const result = new DomainAuthor();
		Object.assign(result, saved);
		return result;
	}

	async saveAll(authors: DomainAuthor[]): Promise<DomainAuthor[]> {
		const entities = authors.map((a) => {
			const entity = this.repository.create();
			Object.assign(entity, a);
			return entity;
		});
		const saved = await this.repository.save(entities);
		return saved.map((s) => {
			const result = new DomainAuthor();
			Object.assign(result, s);
			return result;
		});
	}

	async update(id: string, data: Partial<DomainAuthor>): Promise<void> {
		const updateData = data as QueryDeepPartialEntity<InfrastructureAuthor>;
		await this.repository.update(id, updateData);
	}

	async delete(id: string): Promise<void> {
		await this.repository.delete(id);
	}

	async findByIds(ids: string[]): Promise<DomainAuthor[]> {
		const authors = await this.repository.find({
			where: { id: In(ids) },
			order: { name: 'ASC' },
		});
		return authors.map((a) => {
			const result = new DomainAuthor();
			Object.assign(result, a);
			return result;
		});
	}

	async findOne(
		criteria: FindOptionsWhere<InfrastructureAuthor>,
	): Promise<DomainAuthor | null> {
		const author = await this.repository.findOne({ where: criteria });
		if (!author) return null;
		const result = new DomainAuthor();
		Object.assign(result, author);
		return result;
	}

	async find(
		criteria: FindOptionsWhere<InfrastructureAuthor>,
	): Promise<DomainAuthor[]> {
		const authors = await this.repository.find({ where: criteria });
		return authors.map((a) => {
			const result = new DomainAuthor();
			Object.assign(result, a);
			return result;
		});
	}

	async findOrCreateByName(name: string): Promise<DomainAuthor> {
		let author = await this.repository.findOne({ where: { name } });
		if (!author) {
			author = this.repository.create({ name });
			author = await this.repository.save(author);
		}
		const result = new DomainAuthor();
		Object.assign(result, author);
		return result;
	}

	async findByBookId(bookId: string): Promise<DomainAuthor[]> {
		const book = await this.bookRepository.findOne({
			where: { id: bookId },
			relations: ['authors'],
		});
		return (book?.authors || []).map((a) => {
			const result = new DomainAuthor();
			Object.assign(result, a);
			return result;
		});
	}

	async findByNames(names: string[]): Promise<DomainAuthor[]> {
		if (names.length === 0) return [];
		const authors = await this.repository.find({
			where: { name: In(names) },
		});
		return authors.map((a) => {
			const result = new DomainAuthor();
			Object.assign(result, a);
			return result;
		});
	}

	async searchByNames(names: string[]): Promise<DomainAuthor[]> {
		const authorIds = await Promise.all(
			names.map(async (name) => {
				const author = await this.findOrCreateByName(name);
				return author.id;
			}),
		);

		if (authorIds.length === 0) return [];

		const authors = await this.repository.find({
			where: { id: In(authorIds) },
			order: { name: 'ASC' },
		});
		return authors.map((a) => {
			const result = new DomainAuthor();
			Object.assign(result, a);
			return result;
		});
	}

	async findByBookIds(
		bookIds: string[],
	): Promise<(DomainAuthor & { bookId: string })[]> {
		const results = await this.repository
			.createQueryBuilder('author')
			.innerJoin('author.books', 'book')
			.select(['author.id', 'author.name', 'book.id'])
			.where('book.id IN (:...bookIds)', { bookIds })
			.getRawMany<RawAuthorResult>();

		return results.map((r) => {
			const domainAuthor = new DomainAuthor();
			domainAuthor.id = r.author_id;
			domainAuthor.name = r.author_name;
			return Object.assign(domainAuthor, {
				bookId: r.book_id,
			}) as DomainAuthor & { bookId: string };
		});
	}
}
