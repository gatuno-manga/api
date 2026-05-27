import { AuthorsOptions } from '@books/application/dto/authors-options.dto';
import { IAuthorRepository } from '@books/application/ports/author-repository.interface';
import { Author as DomainAuthor } from '@books/domain/entities/author';
import { AuthorCriteria } from '@books/domain/types/criteria.types';
import { Author as InfrastructureAuthor } from '@books/infrastructure/database/entities/author.entity';
import { Book as InfrastructureBook } from '@books/infrastructure/database/entities/book.entity';
import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, In, Repository } from 'typeorm';

interface RawAuthorResult {
	author_id: string;
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
		@Optional()
		entityManager?: EntityManager,
	) {
		this.repository = entityManager?.getRepository
			? entityManager.getRepository(InfrastructureAuthor)
			: repository;
		this.bookRepository = entityManager?.getRepository
			? entityManager.getRepository(InfrastructureBook)
			: bookRepository;
	}

	async findById(
		id: string,
		relations?: string[],
	): Promise<DomainAuthor | null> {
		const author = await this.repository.findOne({
			where: { id },
			relations,
		});
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
		// Use manual mapping to avoid circular reference resolution issues in linter
		const updateData: Parameters<
			Repository<InfrastructureAuthor>['update']
		>[1] = {};

		if (data.name !== undefined) updateData.name = data.name;
		if (data.biography !== undefined) updateData.biography = data.biography;

		await this.repository.update(id, updateData);
	}

	async delete(id: string): Promise<void> {
		await this.repository.delete(id);
	}

	async deleteByIds(ids: string[]): Promise<void> {
		await this.repository.delete(ids);
	}

	async remove(authors: DomainAuthor[]): Promise<void> {
		const entities = authors.map((a) => {
			const entity = this.repository.create();
			Object.assign(entity, a);
			return entity;
		});
		await this.repository.remove(entities);
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
		const author = await this.repository.findOne({
			where: criteria,
		});
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

	async findByName(name: string): Promise<DomainAuthor | null> {
		const author = await this.repository.findOne({ where: { name } });
		if (!author) return null;
		const result = new DomainAuthor();
		Object.assign(result, author);
		return result;
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

	async findWithFilters(
		options: AuthorsOptions,
		_maxWeight?: number,
	): Promise<DomainAuthor[]> {
		const queryBuilder = this.repository.createQueryBuilder('author');

		const d = options as Record<string, unknown>;
		if (d.search) {
			queryBuilder.where('author.name LIKE :search', {
				search: `%${d.search as string}%`,
			});
		}

		if (d.limit) {
			queryBuilder.take(d.limit as number);
		}

		if (d.offset) {
			queryBuilder.skip(d.offset as number);
		}

		queryBuilder.orderBy('author.name', 'ASC');

		const authors = await queryBuilder.getMany();
		return authors.map((a) => {
			const result = new DomainAuthor();
			Object.assign(result, a);
			return result;
		});
	}

	async findByBookIds(
		bookIds: string[],
	): Promise<(DomainAuthor & { bookId: string })[]> {
		if (bookIds.length === 0) return [];

		// 1. Get all authors and their biographies for these books
		const authors = await this.repository
			.createQueryBuilder('author')
			.leftJoinAndSelect(
				'author.localizedBiographies',
				'localizedBiographies',
			)
			.innerJoin('author.books', 'book')
			.select(['author', 'localizedBiographies', 'book.id'])
			.where('book.id IN (:...bookIds)', { bookIds })
			.getMany();

		// 2. Since getMany doesn't expose the many-to-many book.id link per instance in a way we can use,
		// we fetch the raw mapping separately or use getRawMany.
		const relations = await this.repository
			.createQueryBuilder('author')
			.innerJoin('author.books', 'book')
			.select(['author.id', 'book.id'])
			.where('book.id IN (:...bookIds)', { bookIds })
			.getRawMany<RawAuthorResult>();

		const result: (DomainAuthor & { bookId: string })[] = [];
		for (const rel of relations) {
			const author = authors.find((a) => a.id === rel.author_id);
			if (author) {
				const domainAuthor = new DomainAuthor();
				Object.assign(domainAuthor, author);
				const extended = domainAuthor as unknown as DomainAuthor & {
					bookId: string;
				};
				extended.bookId = rel.book_id;
				result.push(extended);
			}
		}

		return result;
	}

	async count(criteria?: AuthorCriteria): Promise<number> {
		return this.repository.count({
			where: criteria as unknown as FindOptionsWhere<InfrastructureAuthor>,
		});
	}
}
