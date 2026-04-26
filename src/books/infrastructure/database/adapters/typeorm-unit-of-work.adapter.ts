import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { IUnitOfWork } from 'src/common/application/ports/unit-of-work.interface';
import { IBookRepository } from 'src/books/application/ports/book-repository.interface';
import { IChapterRepository } from 'src/books/application/ports/chapter-repository.interface';
import { IAuthorRepository } from 'src/books/application/ports/author-repository.interface';
import { ITagRepository } from 'src/books/application/ports/tag-repository.interface';
import { ISensitiveContentRepository } from 'src/books/application/ports/sensitive-content-repository.interface';
import { TypeOrmBookRepositoryAdapter } from './typeorm-book-repository.adapter';
import { TypeOrmChapterRepositoryAdapter } from './typeorm-chapter-repository.adapter';
import { TypeOrmAuthorRepositoryAdapter } from './typeorm-author-repository.adapter';
import { TypeOrmTagRepositoryAdapter } from './typeorm-tag-repository.adapter';
import { TypeOrmSensitiveContentRepositoryAdapter } from './typeorm-sensitive-content-repository.adapter';
import { InjectRepository } from '@nestjs/typeorm';
import { Book } from '../entities/book.entity';
import { Repository } from 'typeorm';
import { Chapter } from '../entities/chapter.entity';
import { Author } from '../entities/author.entity';
import { Tag } from '../entities/tags.entity';
import { SensitiveContent } from '../entities/sensitive-content.entity';

@Injectable()
export class TypeOrmUnitOfWorkAdapter implements IUnitOfWork {
	private readonly logger = new Logger(TypeOrmUnitOfWorkAdapter.name);
	private queryRunner: QueryRunner | null = null;

	constructor(
		private readonly dataSource: DataSource,
		@InjectRepository(Book)
		private readonly bookRepo: Repository<Book>,
		@InjectRepository(Chapter)
		private readonly chapterRepo: Repository<Chapter>,
		@InjectRepository(Author)
		private readonly authorRepo: Repository<Author>,
		@InjectRepository(Tag)
		private readonly tagRepo: Repository<Tag>,
		@InjectRepository(SensitiveContent)
		private readonly sensitiveRepo: Repository<SensitiveContent>,
	) {}

	async start(): Promise<void> {
		this.queryRunner = this.dataSource.createQueryRunner();
		await this.queryRunner.connect();
		await this.queryRunner.startTransaction();
		this.logger.debug('Transaction started');
	}

	async commit(): Promise<void> {
		if (!this.queryRunner) {
			throw new Error('No transaction in progress');
		}
		try {
			await this.queryRunner.commitTransaction();
			this.logger.debug('Transaction committed');
		} finally {
			await this.release();
		}
	}

	async rollback(): Promise<void> {
		if (!this.queryRunner) return;
		try {
			await this.queryRunner.rollbackTransaction();
			this.logger.debug('Transaction rolled back');
		} finally {
			await this.release();
		}
	}

	private async release(): Promise<void> {
		if (this.queryRunner) {
			await this.queryRunner.release();
			this.queryRunner = null;
		}
	}

	async runInTransaction<T>(
		work: (uow: IUnitOfWork) => Promise<T>,
	): Promise<T> {
		await this.start();
		try {
			const result = await work(this);
			await this.commit();
			return result;
		} catch (error) {
			await this.rollback();
			throw error;
		}
	}

	getBookRepository(): IBookRepository {
		return new TypeOrmBookRepositoryAdapter(
			this.bookRepo,
			this.queryRunner?.manager,
		);
	}

	getChapterRepository(): IChapterRepository {
		return new TypeOrmChapterRepositoryAdapter(
			this.chapterRepo,
			this.queryRunner?.manager,
		);
	}

	getAuthorRepository(): IAuthorRepository {
		return new TypeOrmAuthorRepositoryAdapter(
			this.authorRepo,
			this.bookRepo,
			this.queryRunner?.manager,
		);
	}

	getTagRepository(): ITagRepository {
		return new TypeOrmTagRepositoryAdapter(
			this.tagRepo,
			this.bookRepo,
			this.queryRunner?.manager,
		);
	}

	getSensitiveContentRepository(): ISensitiveContentRepository {
		return new TypeOrmSensitiveContentRepositoryAdapter(
			this.sensitiveRepo,
			this.queryRunner?.manager,
		);
	}
}
