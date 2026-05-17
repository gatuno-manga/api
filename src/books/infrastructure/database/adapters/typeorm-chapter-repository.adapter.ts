import {
	ChapterNavigation,
	IChapterRepository,
} from '@books/application/ports/chapter-repository.interface';
import { Chapter as DomainChapter } from '@books/domain/entities/chapter';
import {
	ChapterCriteria,
	ChapterQueryOptions,
} from '@books/domain/types/criteria.types';
import { Chapter as InfrastructureChapter } from '@books/infrastructure/database/entities/chapter.entity';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	EntityManager,
	FindOptionsOrder,
	FindOptionsWhere,
	In,
	Repository,
} from 'typeorm';

@Injectable()
export class TypeOrmChapterRepositoryAdapter implements IChapterRepository {
	private readonly logger = new Logger(TypeOrmChapterRepositoryAdapter.name);
	private readonly repository: Repository<InfrastructureChapter>;

	constructor(
		@InjectRepository(InfrastructureChapter)
		repository: Repository<InfrastructureChapter>,
		@Optional()
		entityManager?: EntityManager,
	) {
		this.repository = entityManager
			? entityManager.getRepository(InfrastructureChapter)
			: repository;
	}

	async findById(
		id: string,
		relations?: string[],
	): Promise<DomainChapter | null> {
		const chapter = await this.repository.findOne({
			where: { id },
			relations,
		});
		if (!chapter) return null;
		const result = new DomainChapter();
		Object.assign(result, chapter);
		return result;
	}

	async save(chapter: DomainChapter): Promise<DomainChapter> {
		const entity = this.repository.create();
		Object.assign(entity, chapter);
		const saved = await this.repository.save(entity);
		const result = new DomainChapter();
		Object.assign(result, saved);
		return result;
	}

	async saveAll(chapters: DomainChapter[]): Promise<DomainChapter[]> {
		const entities = chapters.map((ch) => {
			const entity = this.repository.create();
			Object.assign(entity, ch);
			return entity;
		});
		const saved = await this.repository.save(entities);
		return saved.map((s) => {
			const result = new DomainChapter();
			Object.assign(result, s);
			return result;
		});
	}

	async update(id: string, data: Partial<DomainChapter>): Promise<void> {
		const updateData =
			data as QueryDeepPartialEntity<InfrastructureChapter>;
		await this.repository.update(id, updateData);
	}

	async delete(id: string): Promise<void> {
		await this.repository.delete(id);
	}

	async softDelete(id: string): Promise<void> {
		await this.repository.softDelete(id);
	}

	async softRemove(chapter: DomainChapter): Promise<void> {
		const entity = this.repository.create();
		Object.assign(entity, chapter);
		await this.repository.softRemove(entity);
	}

	async exists(id: string): Promise<boolean> {
		const count = await this.repository.count({ where: { id } });
		return count > 0;
	}

	async findByIds(ids: string[]): Promise<DomainChapter[]> {
		const chapters = await this.repository.find({
			where: { id: In(ids) },
		});
		return chapters.map((ch) => {
			const result = new DomainChapter();
			Object.assign(result, ch);
			return result;
		});
	}

	async findByBookIds(bookIds: string[]): Promise<DomainChapter[]> {
		const chapters = await this.repository.find({
			where: {
				book: { id: In(bookIds) },
			} as FindOptionsWhere<InfrastructureChapter>,
		});
		return chapters.map((ch) => {
			const result = new DomainChapter();
			Object.assign(result, ch);
			return result;
		});
	}

	async count(criteria?: ChapterCriteria): Promise<number> {
		return this.repository.count({
			where: (criteria || {}) as FindOptionsWhere<InfrastructureChapter>,
		});
	}

	async findByBookId(
		bookId: string,
		options?: ChapterQueryOptions,
	): Promise<DomainChapter[]> {
		const order: FindOptionsOrder<InfrastructureChapter> = {};
		if (options?.order) {
			order.index = options.order;
		} else {
			order.index = 'ASC';
		}

		const chapters = await this.repository.find({
			where: {
				book: { id: bookId },
			} as FindOptionsWhere<InfrastructureChapter>,
			order,
			take: options?.limit,
			skip: options?.offset,
		});
		return chapters.map((ch) => {
			const result = new DomainChapter();
			Object.assign(result, ch);
			return result;
		});
	}

	async findOne(criteria: ChapterCriteria): Promise<DomainChapter | null> {
		const chapter = await this.repository.findOne({
			where: criteria as FindOptionsWhere<InfrastructureChapter>,
		});
		if (!chapter) return null;
		const result = new DomainChapter();
		Object.assign(result, chapter);
		return result;
	}

	async find(criteria: ChapterCriteria): Promise<DomainChapter[]> {
		const chapters = await this.repository.find({
			where: criteria as FindOptionsWhere<InfrastructureChapter>,
		});
		return chapters.map((ch) => {
			const result = new DomainChapter();
			Object.assign(result, ch);
			return result;
		});
	}

	async findWithRelations(
		id: string,
		relations: string[],
	): Promise<DomainChapter | null> {
		const chapter = await this.repository.findOne({
			where: { id },
			relations,
		});
		if (!chapter) return null;
		const result = new DomainChapter();
		Object.assign(result, chapter);
		return result;
	}

	async findChaptersByBookIdWithCursor(
		bookId: string,
		options: ChapterQueryOptions,
		userId?: string,
	): Promise<Record<string, unknown>[]> {
		const chaptersQuery = this.repository
			.createQueryBuilder('chapter')
			.where('chapter.bookId = :bookId', { bookId });

		if (options.cursorIndex !== undefined && options.cursorIndex !== null) {
			const operator = options.order === 'DESC' ? '<' : '>';
			chaptersQuery.andWhere(`chapter.index ${operator} :cursorIndex`, {
				cursorIndex: options.cursorIndex,
			});
		}

		chaptersQuery.orderBy('chapter.index', options.order || 'ASC');

		if (options.limit) {
			chaptersQuery.take(options.limit);
		}

		if (!userId) {
			const result = await chaptersQuery.getMany();
			this.logger.debug(`Found ${result.length} chapters (no userId)`);
			return result.map((ch) => {
				const res: Record<string, unknown> = {};
				Object.assign(res, ch);
				return res;
			});
		}

		chaptersQuery.addSelect(
			(qb) =>
				qb
					.select('COUNT(cr.id)')
					.from('chapters_read', 'cr')
					.where('cr.chapterId = chapter.id')
					.andWhere('cr.userId = :userid', { userid: userId }),
			'readCount',
		);

		const result = await chaptersQuery.getRawMany();
		this.logger.debug(`Found ${result.length} chapters (with userId)`);
		return result as Record<string, unknown>[];
	}

	async findChaptersWithError(bookId: string): Promise<DomainChapter[]> {
		const chapters = await this.repository
			.createQueryBuilder('ch')
			.where('ch.bookId = :bookId', { bookId: bookId })
			.select(['ch.id', 'ch.title', 'ch.scrapingStatus'])
			.getMany();
		return chapters.map((ch) => {
			const result = new DomainChapter();
			Object.assign(result, ch);
			return result;
		});
	}

	async findWithNavigation(id: string): Promise<ChapterNavigation | null> {
		const chapter = await this.repository
			.createQueryBuilder('chapter')
			.leftJoinAndSelect('chapter.book', 'book')
			.leftJoinAndSelect('chapter.pages', 'pages')
			.where('chapter.id = :id', { id })
			.getOne();

		if (!chapter) return null;

		const previousChapter = await this.repository
			.createQueryBuilder('chapter')
			.where('chapter.bookId = :bookId', { bookId: chapter.book.id })
			.andWhere('chapter.index < :currentIndex', {
				currentIndex: chapter.index,
			})
			.orderBy('chapter.index', 'DESC')
			.select(['chapter.id'])
			.getOne();

		const nextChapter = await this.repository
			.createQueryBuilder('chapter')
			.where('chapter.bookId = :bookId', { bookId: chapter.book.id })
			.andWhere('chapter.index > :currentIndex', {
				currentIndex: chapter.index,
			})
			.orderBy('chapter.index', 'ASC')
			.select(['chapter.id'])
			.getOne();

		const maxIndexChapter = await this.repository
			.createQueryBuilder('chapter')
			.where('chapter.bookId = :bookId', { bookId: chapter.book.id })
			.select('MAX(chapter.index)', 'max')
			.getRawOne<{ max: string | number | null }>();

		const domainChapter = new DomainChapter();
		Object.assign(domainChapter, chapter);

		return {
			chapter: domainChapter,
			previousId: previousChapter?.id,
			nextId: nextChapter?.id,
			totalChapters: maxIndexChapter?.max
				? Number(maxIndexChapter.max)
				: 0,
		};
	}

	create(data: Partial<DomainChapter>): DomainChapter {
		const entity = this.repository.create();
		Object.assign(entity, data);
		const result = new DomainChapter();
		Object.assign(result, entity);
		return result;
	}

	merge(chapter: DomainChapter, data: Partial<DomainChapter>): DomainChapter {
		const entity = this.repository.create();
		Object.assign(entity, chapter);
		const merged = this.repository.merge(
			entity,
			data as QueryDeepPartialEntity<InfrastructureChapter>,
		);
		const result = new DomainChapter();
		Object.assign(result, merged);
		return result;
	}

	createQueryBuilder(alias: string): unknown {
		return this.repository.createQueryBuilder(alias);
	}
}
