import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { Author } from '../../../../books/infrastructure/database/entities/author.entity';
import { Book } from '../../../../books/infrastructure/database/entities/book.entity';
import { Chapter } from '../../../../books/infrastructure/database/entities/chapter.entity';
import { Page } from '../../../../books/infrastructure/database/entities/page.entity';
import { SensitiveContent } from '../../../../books/infrastructure/database/entities/sensitive-content.entity';
import { Tag } from '../../../../books/infrastructure/database/entities/tags.entity';
import { User } from '../../../../users/infrastructure/database/entities/user.entity';
import {
	DashboardRepositoryPort,
	DashboardStats,
} from '../../../application/ports/dashboard-repository.port';
import {
	DashboardFilterDto,
	SensitiveContentFilter,
} from '../../../application/dto/dashboard-filter.dto';

interface RawStatusCount {
	status: string | null;
	count: string;
}

interface RawNameCount {
	name: string;
	count: string;
}

@Injectable()
export class TypeOrmDashboardAdapter implements DashboardRepositoryPort {
	constructor(
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(Page)
		private readonly pageRepository: Repository<Page>,
		@InjectRepository(Tag)
		private readonly tagRepository: Repository<Tag>,
		@InjectRepository(Author)
		private readonly authorRepository: Repository<Author>,
		@InjectRepository(SensitiveContent)
		private readonly sensitiveContentRepository: Repository<SensitiveContent>,
	) {}

	async getOverviewStats(
		filter?: DashboardFilterDto,
	): Promise<DashboardStats> {
		const sensitiveFilter =
			filter?.sensitiveContent || SensitiveContentFilter.ALL;

		const applySensitiveFilter = <T extends ObjectLiteral>(
			qb: SelectQueryBuilder<T>,
			alias = 'book',
		) => {
			if (sensitiveFilter === SensitiveContentFilter.EXCLUDE) {
				qb.andWhere((subQb) => {
					const subQuery = subQb
						.subQuery()
						.select('1')
						.from('books_sensitive_content', 'bsc')
						.where(`bsc.booksId = ${alias}.id`)
						.getQuery();
					return `NOT EXISTS ${subQuery}`;
				});
			} else if (sensitiveFilter === SensitiveContentFilter.ONLY) {
				qb.andWhere((subQb) => {
					const subQuery = subQb
						.subQuery()
						.select('1')
						.from('books_sensitive_content', 'bsc')
						.where(`bsc.booksId = ${alias}.id`)
						.getQuery();
					return `EXISTS ${subQuery}`;
				});
			}
		};

		// Base query for counts that depend on book filter
		const bookBaseQb = this.bookRepository.createQueryBuilder('book');
		applySensitiveFilter(bookBaseQb);

		const [
			totalBooks,
			totalUsers,
			totalTags,
			totalAuthors,
			totalSensitiveContent,
		] = await Promise.all([
			bookBaseQb.getCount(),
			this.userRepository.count(),
			this.tagRepository.count(),
			this.authorRepository.count(),
			this.sensitiveContentRepository.count(),
		]);

		// Total chapters (needs join with book if filtered)
		const chapterQb = this.chapterRepository
			.createQueryBuilder('chapter')
			.innerJoin('chapter.book', 'book');
		applySensitiveFilter(chapterQb);
		const totalChapters = await chapterQb.getCount();

		// Total pages (needs join with book if filtered)
		const pageQb = this.pageRepository
			.createQueryBuilder('page')
			.innerJoin('page.chapter', 'chapter')
			.innerJoin('chapter.book', 'book');
		applySensitiveFilter(pageQb);
		const totalPages = await pageQb.getCount();

		// Agrupar status de scraping dos livros
		const booksByStatusQb = this.bookRepository
			.createQueryBuilder('book')
			.select('book.scrapingStatus', 'status')
			.addSelect('COUNT(book.id)', 'count')
			.groupBy('book.scrapingStatus');
		applySensitiveFilter(booksByStatusQb);
		const booksByStatus =
			await booksByStatusQb.getRawMany<RawStatusCount>();

		// Agrupar status de scraping dos capítulos
		const chaptersByStatusQb = this.chapterRepository
			.createQueryBuilder('chapter')
			.innerJoin('chapter.book', 'book')
			.select('chapter.scrapingStatus', 'status')
			.addSelect('COUNT(chapter.id)', 'count')
			.groupBy('chapter.scrapingStatus');
		applySensitiveFilter(chaptersByStatusQb);
		const chaptersByStatus =
			await chaptersByStatusQb.getRawMany<RawStatusCount>();

		// Agrupar livros por conteúdo sensível
		const sensitiveContentDistributionQb = this.bookRepository
			.createQueryBuilder('book')
			.innerJoin('book.sensitiveContent', 'sc')
			.select('sc.name', 'name')
			.addSelect('COUNT(book.id)', 'count')
			.groupBy('sc.name');
		applySensitiveFilter(sensitiveContentDistributionQb);
		const sensitiveContentDistribution =
			await sensitiveContentDistributionQb.getRawMany<RawNameCount>();

		// Agrupar livros por tags (Top 10)
		const tagsDistributionQb = this.bookRepository
			.createQueryBuilder('book')
			.innerJoin('book.tags', 'tag')
			.select('tag.name', 'name')
			.addSelect('COUNT(book.id)', 'count')
			.groupBy('tag.name')
			.orderBy('count', 'DESC')
			.limit(10);
		applySensitiveFilter(tagsDistributionQb);
		const tagsDistribution =
			await tagsDistributionQb.getRawMany<RawNameCount>();

		return {
			counts: {
				books: totalBooks,
				chapters: totalChapters,
				users: totalUsers,
				pages: totalPages,
				tags: totalTags,
				authors: totalAuthors,
				sensitiveContent: totalSensitiveContent,
			},
			status: {
				books: booksByStatus.map((item) => ({
					status: item.status || 'UNKNOWN',
					count: Number.parseInt(item.count),
				})),
				chapters: chaptersByStatus.map((item) => ({
					status: item.status || 'UNKNOWN',
					count: Number.parseInt(item.count),
				})),
			},
			sensitiveContent: sensitiveContentDistribution.map((item) => ({
				name: item.name,
				count: Number.parseInt(item.count),
			})),
			tags: tagsDistribution.map((item) => ({
				name: item.name,
				count: Number.parseInt(item.count),
			})),
		};
	}
}
