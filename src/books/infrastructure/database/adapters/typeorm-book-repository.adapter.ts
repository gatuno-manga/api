import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	Repository,
	FindOptionsWhere,
	DeepPartial,
	EntityManager,
} from 'typeorm';
import { IBookRepository } from '@books/application/ports/book-repository.interface';
import { Book as DomainBook } from '@books/domain/entities/book';
import { Book as InfrastructureBook } from '@books/infrastructure/database/entities/book.entity';
import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import { FilterStrategy } from '@books/application/strategies/filter-strategy.interface';
import { OrderDirection } from 'src/common/enum/order-direction.enum';
import { BookOrderField } from '@books/domain/enums/book-order-field.enum';
import {
	BookCriteria,
	AccessContext,
} from '@books/domain/types/criteria.types';

@Injectable()
export class TypeOrmBookRepositoryAdapter implements IBookRepository {
	private readonly logger = new Logger(TypeOrmBookRepositoryAdapter.name);
	private readonly repository: Repository<InfrastructureBook>;

	constructor(
		@InjectRepository(InfrastructureBook)
		repository: Repository<InfrastructureBook>,
		entityManager?: EntityManager,
	) {
		this.repository = entityManager
			? entityManager.getRepository(InfrastructureBook)
			: repository;
	}

	async findById(
		id: string,
		relations?: string[],
	): Promise<DomainBook | null> {
		const book = await this.repository.findOne({
			where: { id } as unknown as FindOptionsWhere<InfrastructureBook>,
			relations,
		});
		return book as unknown as DomainBook;
	}

	async findByIdWithDetails(id: string): Promise<DomainBook | null> {
		const book = await this.repository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.tags', 'tags')
			.leftJoinAndSelect('book.authors', 'authors')
			.leftJoinAndSelect('book.sensitiveContent', 'sensitiveContent')
			.leftJoinAndSelect(
				'book.covers',
				'covers',
				'covers.selected = :selected',
				{ selected: true },
			)
			.loadRelationCountAndMap('book.totalChapters', 'book.chapters')
			.where('book.id = :id', { id })
			.getOne();
		return book as unknown as DomainBook;
	}

	async save(book: DomainBook): Promise<DomainBook> {
		const saved = await this.repository.save(
			book as unknown as InfrastructureBook,
		);
		return saved as unknown as DomainBook;
	}

	async update(id: string, data: Partial<DomainBook>): Promise<void> {
		await this.repository.update(
			id,
			data as unknown as DeepPartial<InfrastructureBook>,
		);
	}

	async delete(id: string): Promise<void> {
		await this.repository.delete(id);
	}

	async softDelete(id: string): Promise<void> {
		await this.repository.softDelete(id);
	}

	async exists(id: string): Promise<boolean> {
		return this.repository.exists({
			where: { id } as unknown as FindOptionsWhere<InfrastructureBook>,
		});
	}

	async count(criteria?: BookCriteria): Promise<number> {
		return this.repository.count({
			where: criteria as unknown as FindOptionsWhere<InfrastructureBook>,
		});
	}

	async findByTitle(title: string): Promise<DomainBook | null> {
		const book = await this.repository.findOne({
			where: { title } as unknown as FindOptionsWhere<InfrastructureBook>,
		});
		return book as unknown as DomainBook;
	}

	async findOne(criteria: BookCriteria): Promise<DomainBook | null> {
		const book = await this.repository.findOne({
			where: criteria as unknown as FindOptionsWhere<InfrastructureBook>,
		});
		return book as unknown as DomainBook;
	}

	async findWithFilters(
		options: BookPageOptionsDto,
		accessContext: AccessContext,
		filterStrategies: FilterStrategy[],
	): Promise<[DomainBook[], number]> {
		this.logger.debug(
			`findWithFilters options: ${JSON.stringify(options)}`,
		);
		this.logger.debug(`accessContext: ${JSON.stringify(accessContext)}`);

		const queryBuilder = this.repository.createQueryBuilder('book');

		// 1. Join covers (only selected)
		queryBuilder.leftJoinAndSelect(
			'book.covers',
			'covers',
			'covers.selected = :selected',
			{ selected: true },
		);

		// 2. Apply Access Policy Filters
		if (accessContext.blockedAll) {
			this.logger.debug('Blocked all by access context');
			return [[], 0];
		}

		// Deny specific books
		if (accessContext.denyBookIds?.length) {
			queryBuilder.andWhere('book.id NOT IN (:...denyBookIds)', {
				denyBookIds: accessContext.denyBookIds,
			});
		}

		// Apply Max Weight Sensitive Content
		const maxWeight = accessContext.effectiveMaxWeightSensitiveContent;

		// Filter by sensitive content weight using NOT EXISTS
		queryBuilder.andWhere((qb) => {
			const subQuery = qb
				.subQuery()
				.select('1')
				.from('books_sensitive_content_sensitive_content', 'bsc')
				.innerJoin(
					'sensitive_content',
					'sc',
					'sc.id = bsc.sensitiveContentId',
				)
				.where('bsc.booksId = book.id')
				.andWhere('sc.weight > :maxWeight', { maxWeight });

			if (accessContext.allowSensitiveContentIds?.length) {
				subQuery.andWhere('sc.id NOT IN (:...allowScIds)', {
					allowScIds: accessContext.allowSensitiveContentIds,
				});
			}

			return `NOT EXISTS ${subQuery.getQuery()}`;
		});

		// Deny specific sensitive content IDs
		if (accessContext.denySensitiveContentIds?.length) {
			queryBuilder.andWhere((qb) => {
				const subQuery = qb
					.subQuery()
					.select('1')
					.from(
						'books_sensitive_content_sensitive_content',
						'dsc_bsc',
					)
					.where('dsc_bsc.booksId = book.id')
					.andWhere('dsc_bsc.sensitiveContentId IN (:...denyScIds)', {
						denyScIds: accessContext.denySensitiveContentIds,
					});
				return `NOT EXISTS ${subQuery.getQuery()}`;
			});
		}

		// Deny specific tag IDs
		if (accessContext.denyTagIds?.length) {
			queryBuilder.andWhere((qb) => {
				const subQuery = qb
					.subQuery()
					.select('1')
					.from('books_tags_tags', 'dt_bt')
					.where('dt_bt.booksId = book.id')
					.andWhere('dt_bt.tagsId IN (:...denyTagIds)', {
						denyTagIds: accessContext.denyTagIds,
					});
				return `NOT EXISTS ${subQuery.getQuery()}`;
			});
		}

		// 3. Apply Filter Strategies
		for (const strategy of filterStrategies) {
			if (strategy.canApply(options)) {
				await strategy.apply(queryBuilder, options);
			}
		}

		// 4. Sorting
		const orderBy = options.orderBy || BookOrderField.CREATED_AT;
		const orderDirection = options.order || OrderDirection.DESC;
		queryBuilder.orderBy(`book.${orderBy}`, orderDirection);
		if (orderBy !== BookOrderField.CREATED_AT) {
			queryBuilder.addOrderBy('book.createdAt', 'DESC');
		}

		// 5. Pagination
		queryBuilder
			.skip((options.page - 1) * options.limit)
			.take(options.limit);

		this.logger.debug(`Generated SQL: ${queryBuilder.getSql()}`);

		try {
			const [books, total] = await queryBuilder.getManyAndCount();
			this.logger.debug(
				`Found ${books.length} books out of ${total} total`,
			);
			return [books as unknown as DomainBook[], total];
		} catch (error) {
			this.logger.error(
				`Error in findWithFilters: ${error.message}`,
				error.stack,
			);
			return [[], 0];
		}
	}

	async findRandom(
		options: BookPageOptionsDto,
		accessContext: AccessContext,
		filterStrategies: FilterStrategy[],
	): Promise<DomainBook | null> {
		const queryBuilder = this.repository.createQueryBuilder('book');

		// 1. Join covers (only selected)
		queryBuilder.leftJoinAndSelect(
			'book.covers',
			'covers',
			'covers.selected = :selected',
			{ selected: true },
		);

		// 2. Apply Access Policy Filters (same logic as findWithFilters)
		if (accessContext.blockedAll) {
			return null;
		}

		if (accessContext.denyBookIds?.length) {
			queryBuilder.andWhere('book.id NOT IN (:...denyBookIds)', {
				denyBookIds: accessContext.denyBookIds,
			});
		}

		const maxWeight = accessContext.effectiveMaxWeightSensitiveContent;
		queryBuilder.andWhere((qb) => {
			const subQuery = qb
				.subQuery()
				.select('1')
				.from('books_sensitive_content_sensitive_content', 'sc_bsc')
				.innerJoin(
					'sensitive_content',
					'sc',
					'sc.id = sc_bsc.sensitiveContentId',
				)
				.where('sc_bsc.booksId = book.id')
				.andWhere('sc.weight > :maxWeight', { maxWeight });

			if (accessContext.allowSensitiveContentIds?.length) {
				subQuery.andWhere('sc.id NOT IN (:...allowScIds)', {
					allowScIds: accessContext.allowSensitiveContentIds,
				});
			}

			return `NOT EXISTS ${subQuery.getQuery()}`;
		});

		if (accessContext.denySensitiveContentIds?.length) {
			queryBuilder.andWhere((qb) => {
				const subQuery = qb
					.subQuery()
					.select('1')
					.from(
						'books_sensitive_content_sensitive_content',
						'dsc_bsc',
					)
					.where('dsc_bsc.booksId = book.id')
					.andWhere('dsc_bsc.sensitiveContentId IN (:...denyScIds)', {
						denyScIds: accessContext.denySensitiveContentIds,
					});
				return `NOT EXISTS ${subQuery.getQuery()}`;
			});
		}

		if (accessContext.denyTagIds?.length) {
			queryBuilder.andWhere((qb) => {
				const subQuery = qb
					.subQuery()
					.select('1')
					.from('books_tags_tags', 'dt_bt')
					.where('dt_bt.booksId = book.id')
					.andWhere('dt_bt.tagsId IN (:...denyTagIds)', {
						denyTagIds: accessContext.denyTagIds,
					});
				return `NOT EXISTS ${subQuery.getQuery()}`;
			});
		}

		// 3. Apply Filter Strategies
		for (const strategy of filterStrategies) {
			if (strategy.canApply(options)) {
				await strategy.apply(queryBuilder, options);
			}
		}

		// 4. Random selection
		queryBuilder.orderBy('RAND()');

		try {
			return (await queryBuilder.getOne()) as unknown as DomainBook;
		} catch (error) {
			this.logger.error(
				`Error in findRandom: ${error.message}`,
				error.stack,
			);
			return null;
		}
	}

	async findAllInProcess(): Promise<DomainBook[]> {
		const books = await this.repository
			.createQueryBuilder('book')
			.leftJoin('book.chapters', 'chapter')
			.where('chapter.scrapingStatus = :status', {
				status: 'process',
			})
			.getMany();
		return books as unknown as DomainBook[];
	}

	async checkBookTitleConflict(
		title: string,
		alternativeTitles: string[] = [],
	): Promise<{
		conflict: boolean;
		existingBook?: {
			id: string;
			title: string;
			alternativeTitle?: string[];
		};
		conflictingBooks?: Array<{
			id: string;
			title: string;
			alternativeTitle?: string[];
		}>;
	}> {
		const queryBuilder = this.repository.createQueryBuilder('book');
		const allTitles = [title, ...alternativeTitles];

		for (let i = 0; i < allTitles.length; i++) {
			const titleToCheck = allTitles[i];
			if (i === 0) {
				queryBuilder.where(`book.title = :title${i}`, {
					[`title${i}`]: titleToCheck,
				});
			} else {
				queryBuilder.orWhere(`book.title = :title${i}`, {
					[`title${i}`]: titleToCheck,
				});
			}

			queryBuilder.orWhere(
				`JSON_CONTAINS(book.alternativeTitle, :jsonTitle${i})`,
				{
					[`jsonTitle${i}`]: JSON.stringify(titleToCheck),
				},
			);
		}

		const conflictingBooks = await queryBuilder.getMany();

		if (conflictingBooks.length > 0) {
			const formattedBooks = conflictingBooks.map((book) => ({
				id: book.id,
				title: book.title,
				alternativeTitle: book.alternativeTitle,
			}));

			return {
				conflict: true,
				existingBook: formattedBooks[0],
				conflictingBooks: formattedBooks,
			};
		}

		return { conflict: false };
	}
}
