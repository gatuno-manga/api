import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

	async getOverviewStats(): Promise<DashboardStats> {
		const [
			totalBooks,
			totalChapters,
			totalUsers,
			totalPages,
			totalTags,
			totalAuthors,
			totalSensitiveContent,
		] = await Promise.all([
			this.bookRepository.count(),
			this.chapterRepository.count(),
			this.userRepository.count(),
			this.pageRepository.count(),
			this.tagRepository.count(),
			this.authorRepository.count(),
			this.sensitiveContentRepository.count(),
		]);

		// Agrupar status de scraping dos livros
		const booksByStatus = await this.bookRepository
			.createQueryBuilder('book')
			.select('book.scrapingStatus', 'status')
			.addSelect('COUNT(book.id)', 'count')
			.groupBy('book.scrapingStatus')
			.getRawMany<RawStatusCount>();

		// Agrupar status de scraping dos capítulos
		const chaptersByStatus = await this.chapterRepository
			.createQueryBuilder('chapter')
			.select('chapter.scrapingStatus', 'status')
			.addSelect('COUNT(chapter.id)', 'count')
			.groupBy('chapter.scrapingStatus')
			.getRawMany<RawStatusCount>();

		// Agrupar livros por conteúdo sensível
		const sensitiveContentDistribution = await this.bookRepository
			.createQueryBuilder('book')
			.leftJoin('book.sensitiveContent', 'sc')
			.select('sc.name', 'name')
			.addSelect('COUNT(book.id)', 'count')
			.where('sc.id IS NOT NULL')
			.groupBy('sc.name')
			.getRawMany<RawNameCount>();

		// Agrupar livros por tags (Top 10)
		const tagsDistribution = await this.bookRepository
			.createQueryBuilder('book')
			.leftJoin('book.tags', 'tag')
			.select('tag.name', 'name')
			.addSelect('COUNT(book.id)', 'count')
			.where('tag.id IS NOT NULL')
			.groupBy('tag.name')
			.orderBy('count', 'DESC')
			.limit(10)
			.getRawMany<RawNameCount>();

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
