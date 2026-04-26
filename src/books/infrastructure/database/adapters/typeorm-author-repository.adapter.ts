import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, FindOptionsWhere, EntityManager } from 'typeorm';
import { IAuthorRepository } from '@books/application/ports/author-repository.interface';
import { Author as DomainAuthor } from '@books/domain/entities/author';
import { Author as InfrastructureAuthor } from '@books/infrastructure/database/entities/author.entity';
import { AuthorsOptions } from '@books/application/dto/authors-options.dto';
import { Book as InfrastructureBook } from '@books/infrastructure/database/entities/book.entity';
import { AuthorCriteria } from '@books/domain/types/criteria.types';

@Injectable()
export class TypeOrmAuthorRepositoryAdapter implements IAuthorRepository {
	private readonly repository: Repository<InfrastructureAuthor>;
	private readonly bookRepository: Repository<InfrastructureBook>;

	constructor(
		@InjectRepository(InfrastructureAuthor)
		repository: Repository<InfrastructureAuthor>,
		@InjectRepository(InfrastructureBook)
		bookRepository: Repository<InfrastructureBook>,
		entityManager?: EntityManager,
	) {
		this.repository = entityManager
			? entityManager.getRepository(InfrastructureAuthor)
			: repository;
		this.bookRepository = entityManager
			? entityManager.getRepository(InfrastructureBook)
			: bookRepository;
	}

	async findById(
		id: string,
		relations?: string[],
	): Promise<DomainAuthor | null> {
		const author = await this.repository.findOne({
			where: { id } as unknown as FindOptionsWhere<InfrastructureAuthor>,
			relations,
		});
		return author as unknown as DomainAuthor;
	}

	async save(author: DomainAuthor): Promise<DomainAuthor> {
		const saved = await this.repository.save(
			author as unknown as InfrastructureAuthor,
		);
		return saved as unknown as DomainAuthor;
	}

	async remove(authors: DomainAuthor[]): Promise<void> {
		await this.repository.remove(
			authors as unknown as InfrastructureAuthor[],
		);
	}

	async deleteByIds(ids: string[]): Promise<void> {
		await this.repository.delete(ids);
	}

	async findByName(name: string): Promise<DomainAuthor | null> {
		const author = await this.repository.findOne({
			where: {
				name,
			} as unknown as FindOptionsWhere<InfrastructureAuthor>,
		});
		return author as unknown as DomainAuthor;
	}

	async count(criteria?: AuthorCriteria): Promise<number> {
		return this.repository.count({
			where: criteria as unknown as FindOptionsWhere<InfrastructureAuthor>,
		});
	}

	async findWithFilters(
		options: AuthorsOptions,
		maxWeight = 99,
	): Promise<DomainAuthor[]> {
		const queryBuilder = this.bookRepository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.authors', 'author')
			.leftJoin('book.sensitiveContent', 'sensitiveContent');

		if (options.sensitiveContent && options.sensitiveContent.length > 0) {
			queryBuilder.andWhere('sensitiveContent.name IN (:...names)', {
				names: options.sensitiveContent,
			});
		}
		queryBuilder.andWhere(
			'sensitiveContent.weight <= :maxWeight OR sensitiveContent.id IS NULL',
			{ maxWeight },
		);

		const books = await queryBuilder.getMany();
		const authorIds = Array.from(
			new Set(
				books.flatMap((book) =>
					book.authors.map((author) => author.id),
				),
			),
		);

		if (authorIds.length === 0) return [];

		const authors = await this.repository.find({
			where: { id: In(authorIds) },
			order: { name: 'ASC' },
		});
		return authors as unknown as DomainAuthor[];
	}
}
