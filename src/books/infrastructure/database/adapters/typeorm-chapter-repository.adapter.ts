import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	In,
	Repository,
	FindOptionsWhere,
	DeepPartial,
	FindOptionsOrder,
	EntityManager,
} from 'typeorm';
import { IChapterRepository } from '@books/application/ports/chapter-repository.interface';
import { Chapter as DomainChapter } from '@books/domain/entities/chapter';
import { Chapter as InfrastructureChapter } from '@books/infrastructure/database/entities/chapter.entity';
import {
	ChapterCriteria,
	ChapterQueryOptions,
} from '@books/domain/types/criteria.types';

@Injectable()
export class TypeOrmChapterRepositoryAdapter implements IChapterRepository {
	private readonly logger = new Logger(TypeOrmChapterRepositoryAdapter.name);
	private readonly repository: Repository<InfrastructureChapter>;

	constructor(
		@InjectRepository(InfrastructureChapter)
		repository: Repository<InfrastructureChapter>,
		entityManager?: EntityManager,
	) {
		this.repository = entityManager
			? entityManager.getRepository(InfrastructureChapter)
			: repository;
	}

	createQueryBuilder(alias: string) {
		return this.repository.createQueryBuilder(alias);
	}

	async findById(
		id: string,
		relations?: string[],
	): Promise<DomainChapter | null> {
		const chapter = await this.repository.findOne({
			where: { id } as unknown as FindOptionsWhere<InfrastructureChapter>,
			relations,
		});
		return chapter as unknown as DomainChapter;
	}

	async save(chapter: DomainChapter): Promise<DomainChapter> {
		const saved = await this.repository.save(
			chapter as unknown as InfrastructureChapter,
		);
		return saved as unknown as DomainChapter;
	}

	async saveAll(chapters: DomainChapter[]): Promise<DomainChapter[]> {
		const saved = await this.repository.save(
			chapters as unknown as InfrastructureChapter[],
		);
		return saved as unknown as DomainChapter[];
	}

	async update(id: string, data: Partial<DomainChapter>): Promise<void> {
		await this.repository.update(
			id,
			data as unknown as DeepPartial<InfrastructureChapter>,
		);
	}

	async delete(id: string): Promise<void> {
		await this.repository.delete(id);
	}

	async softDelete(id: string): Promise<void> {
		await this.repository.softDelete(id);
	}

	async softRemove(chapter: DomainChapter): Promise<void> {
		await this.repository.softRemove(
			chapter as unknown as InfrastructureChapter,
		);
	}

	async exists(id: string): Promise<boolean> {
		return this.repository.exists({
			where: { id } as unknown as FindOptionsWhere<InfrastructureChapter>,
		});
	}

	async findByIds(ids: string[]): Promise<DomainChapter[]> {
		const chapters = await this.repository.find({
			where: {
				id: In(ids),
			} as unknown as FindOptionsWhere<InfrastructureChapter>,
		});
		return chapters as unknown as DomainChapter[];
	}

	async count(criteria?: ChapterCriteria): Promise<number> {
		return this.repository.count({
			where: criteria as unknown as FindOptionsWhere<InfrastructureChapter>,
		});
	}

	async findByBookId(
		bookId: string,
		options?: ChapterQueryOptions,
	): Promise<DomainChapter[]> {
		const chapters = await this.repository.find({
			where: {
				book: { id: bookId },
			} as unknown as FindOptionsWhere<InfrastructureChapter>,
			...options,
			order: {
				index: options?.order || 'ASC',
			} as unknown as FindOptionsOrder<InfrastructureChapter>,
		});
		return chapters as unknown as DomainChapter[];
	}

	async findOne(criteria: ChapterCriteria): Promise<DomainChapter | null> {
		const chapter = await this.repository.findOne({
			where: criteria as unknown as FindOptionsWhere<InfrastructureChapter>,
		});
		return chapter as unknown as DomainChapter;
	}

	async find(criteria: ChapterCriteria): Promise<DomainChapter[]> {
		const chapters = await this.repository.find({
			where: criteria as unknown as FindOptionsWhere<InfrastructureChapter>,
		});
		return chapters as unknown as DomainChapter[];
	}

	async findWithRelations(
		id: string,
		relations: string[],
	): Promise<DomainChapter | null> {
		const chapter = await this.repository.findOne({
			where: { id } as unknown as FindOptionsWhere<InfrastructureChapter>,
			relations,
		});
		return chapter as unknown as DomainChapter;
	}

	async findChaptersByBookIdWithCursor(
		bookId: string,
		options: ChapterQueryOptions,
		userId?: string,
	): Promise<unknown[]> {
		this.logger.debug(
			`findChaptersByBookIdWithCursor bookId=${bookId} options=${JSON.stringify(options)} userId=${userId}`,
		);

		const chaptersQuery = this.repository
			.createQueryBuilder('chapter')
			.where('chapter.bookId = :id', { id: bookId })
			.select([
				'chapter.id',
				'chapter.title',
				'chapter.index',
				'chapter.scrapingStatus',
			])
			.orderBy('chapter.index', options.order || 'ASC')
			.limit((options.limit || 200) + 1);

		if (
			options.cursorIndex !== undefined &&
			options.cursorIndex !== null &&
			!Number.isNaN(Number(options.cursorIndex))
		) {
			if (options.order === 'DESC') {
				chaptersQuery.andWhere('chapter.index < :cursorIndex', {
					cursorIndex: options.cursorIndex,
				});
			} else {
				chaptersQuery.andWhere('chapter.index > :cursorIndex', {
					cursorIndex: options.cursorIndex,
				});
			}
		}

		if (!userId) {
			const result = await chaptersQuery.getMany();
			this.logger.debug(`Found ${result.length} chapters (no userId)`);
			return result;
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
		return result;
	}

	async findChaptersWithError(bookId: string): Promise<unknown[]> {
		return this.repository
			.createQueryBuilder('ch')
			.where('ch.bookId = :bookId', { bookId: bookId })
			.select(['ch.id', 'ch.title', 'ch.scrapingStatus'])
			.getMany();
	}

	async findWithNavigation(id: string): Promise<unknown> {
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

		return {
			chapter,
			previousId: previousChapter?.id,
			nextId: nextChapter?.id,
			totalChapters: maxIndexChapter?.max
				? Number(maxIndexChapter.max)
				: 0,
		};
	}

	create(data: Partial<DomainChapter>): DomainChapter {
		const chapter = this.repository.create(
			data as unknown as DeepPartial<InfrastructureChapter>,
		);
		return chapter as unknown as DomainChapter;
	}

	merge(chapter: DomainChapter, data: Partial<DomainChapter>): DomainChapter {
		const merged = this.repository.merge(
			chapter as unknown as InfrastructureChapter,
			data as unknown as DeepPartial<InfrastructureChapter>,
		);
		return merged as unknown as DomainChapter;
	}
}
