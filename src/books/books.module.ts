import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../infrastructure/app-config/app-config.module';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { LoggingModule } from '../infrastructure/logging/logging.module';
import { MetricsModule } from '../metrics/metrics.module';
import { ScrapingModule } from '../scraping/scraping.module';
import { UsersModule } from '../users/users.module';
import { User } from '../users/infrastructure/database/entities/user.entity';
import { AdminBooksDashboardController } from './infrastructure/http/controllers/admin-books-dashboard.controller';
import { AdminBookRelationshipsController } from './infrastructure/http/controllers/admin-book-relationships.controller';
import { AdminBooksUploadController } from './infrastructure/http/controllers/admin-books-upload.controller';
import { AdminBooksController } from './infrastructure/http/controllers/admin-books.controller';
import { BooksController } from './infrastructure/http/controllers/books.controller';
import { BooksService } from './application/services/books.service';
import { ChapterController } from './infrastructure/http/controllers/chapter.controller';
import { ChapterCommentsController } from './infrastructure/http/controllers/chapter-comments.controller';
import { ChapterCommentsService } from './application/services/chapter-comments.service';
import { ChapterService } from './application/services/chapter.service';
import { DownloadModule } from './application/services/download.module';
import { Author } from './infrastructure/database/entities/author.entity';
import { BookRelationship } from './infrastructure/database/entities/book-relationship.entity';
import { Book } from './infrastructure/database/entities/book.entity';
import { Chapter } from './infrastructure/database/entities/chapter.entity';
import { ChapterComment } from './infrastructure/database/entities/chapter-comment.entity';
import { Cover } from './infrastructure/database/entities/cover.entity';
import { Page } from './infrastructure/database/entities/page.entity';
import { SensitiveContent } from './infrastructure/database/entities/sensitive-content.entity';
import { Tag } from './infrastructure/database/entities/tags.entity';
import { ChapterRead } from './infrastructure/database/entities/chapter-read.entity';
import { BookInitEvents } from './infrastructure/events/book.init.events';
import { BookScrapingEvents } from './infrastructure/events/book.scraping.events';
import { FileDeletionEvents } from './infrastructure/events/file-deletion.events';
import { BooksGateway } from './infrastructure/gateways/books.gateway';
import { BookUpdateProcessor } from './infrastructure/jobs/book-update.processor';
import { BookUpdateScheduler } from './infrastructure/jobs/book-update.scheduler';
import { BookUpdateJobService } from './infrastructure/jobs/book-update.service';
import { ChapterScrapingJob } from './infrastructure/jobs/chapter-scraping.job';
import { ChapterScrapingService } from './infrastructure/jobs/chapter-scraping.service';
import { ChapterScrapingSharedService } from './infrastructure/jobs/chapter-scraping.shared';
import { CoverImageProcessor } from './infrastructure/jobs/cover-image.processor';
import { CoverImageService } from './infrastructure/jobs/cover-image.service';
import { FixChapterProcessor } from './infrastructure/jobs/fix-chapter.processor';
import { FixChapterService } from './infrastructure/jobs/fix-chapter.service';
import { SensitiveContentController } from './infrastructure/http/controllers/sensitive-content.controller';
import { SensitiveContentService } from './application/services/sensitive-content.service';
import { BookContentUpdateService } from './application/services/book-content-update.service';
import { BookCreationService } from './application/services/book-creation.service';
import { BookDeletionService } from './application/services/book-deletion.service';
import { BookBookRelationshipService } from './application/services/book-book-relationship.service';
import { BookQueryService } from './application/services/book-query.service';
import { BookRelationshipService } from './application/services/book-relationship.service';
import { BookUpdateService } from './application/services/book-update.service';
import { BookUploadService } from './application/services/book-upload.service';
import { ChapterManagementService } from './application/services/chapter-management.service';
import { TagsController } from './infrastructure/http/controllers/tags.controller';
import { TagsService } from './application/services/tags.service';

import { I_BOOK_REPOSITORY } from './application/ports/book-repository.interface';
import { TypeOrmBookRepositoryAdapter } from './infrastructure/database/adapters/typeorm-book-repository.adapter';
import { I_CHAPTER_REPOSITORY } from './application/ports/chapter-repository.interface';
import { TypeOrmChapterRepositoryAdapter } from './infrastructure/database/adapters/typeorm-chapter-repository.adapter';
import { I_COVER_REPOSITORY } from './application/ports/cover-repository.interface';
import { TypeOrmCoverRepositoryAdapter } from './infrastructure/database/adapters/typeorm-cover-repository.adapter';
import { I_PAGE_REPOSITORY } from './application/ports/page-repository.interface';
import { TypeOrmPageRepositoryAdapter } from './infrastructure/database/adapters/typeorm-page-repository.adapter';
import { I_TAG_REPOSITORY } from './application/ports/tag-repository.interface';
import { TypeOrmTagRepositoryAdapter } from './infrastructure/database/adapters/typeorm-tag-repository.adapter';
import { I_AUTHOR_REPOSITORY } from './application/ports/author-repository.interface';
import { TypeOrmAuthorRepositoryAdapter } from './infrastructure/database/adapters/typeorm-author-repository.adapter';
import { I_SENSITIVE_CONTENT_REPOSITORY } from './application/ports/sensitive-content-repository.interface';
import { TypeOrmSensitiveContentRepositoryAdapter } from './infrastructure/database/adapters/typeorm-sensitive-content-repository.adapter';
import { I_BOOK_RELATIONSHIP_REPOSITORY } from './application/ports/book-relationship-repository.interface';
import { TypeOrmBookRelationshipRepositoryAdapter } from './infrastructure/database/adapters/typeorm-book-relationship-repository.adapter';
import { I_CHAPTER_READ_REPOSITORY } from './application/ports/chapter-read-repository.interface';
import { TypeOrmChapterReadRepositoryAdapter } from './infrastructure/database/adapters/typeorm-chapter-read-repository.adapter';
import { I_CHAPTER_COMMENT_REPOSITORY } from './application/ports/chapter-comment-repository.interface';
import { TypeOrmChapterCommentRepositoryAdapter } from './infrastructure/database/adapters/typeorm-chapter-comment-repository.adapter';
import { I_UNIT_OF_WORK } from 'src/common/application/ports/unit-of-work.interface';
import { TypeOrmUnitOfWorkAdapter } from './infrastructure/database/adapters/typeorm-unit-of-work.adapter';

import { BookResolver } from './infrastructure/graphql/resolvers/book.resolver';

@Module({
	imports: [
		ScrapingModule,
		AppConfigModule,
		FilesModule,
		LoggingModule,
		MetricsModule,
		ScheduleModule.forRoot(),
		DownloadModule,
		UsersModule,
		TypeOrmModule.forFeature([
			Book,
			BookRelationship,
			Page,
			Chapter,
			ChapterComment,
			User,
			Tag,
			Author,
			ChapterRead,
			SensitiveContent,
			Cover,
		]),
		AuthModule,
		BullModule.registerQueue(
			{
				name: 'chapter-scraping',
				defaultJobOptions: {
					attempts: 3,
					removeOnFail: 10,
					delay: 10000,
					backoff: {
						type: 'exponential',
						delay: 5000,
					},
				},
			},
			{
				name: 'cover-image-queue',
				defaultJobOptions: {
					attempts: 3,
					removeOnFail: 10,
					delay: 10000,
					backoff: {
						type: 'exponential',
						delay: 5000,
					},
				},
			},
			{
				name: 'fix-chapter-queue',
				defaultJobOptions: {
					attempts: 3,
					removeOnFail: 10,
					delay: 10000,
					backoff: {
						type: 'exponential',
						delay: 5000,
					},
				},
			},
			{
				name: 'book-update-queue',
				defaultJobOptions: {
					attempts: 3,
					removeOnFail: 10,
					delay: 30000, // 30 segundos entre jobs
					backoff: {
						type: 'exponential',
						delay: 60000, // 1 minuto de backoff
					},
				},
			},
		),
	],
	controllers: [
		BooksController,
		ChapterController,
		ChapterCommentsController,
		SensitiveContentController,
		TagsController,
		AdminBooksController,
		AdminBookRelationshipsController,
		AdminBooksUploadController,
		AdminBooksDashboardController,
	],
	providers: [
		{ provide: I_BOOK_REPOSITORY, useClass: TypeOrmBookRepositoryAdapter },
		{
			provide: I_CHAPTER_REPOSITORY,
			useClass: TypeOrmChapterRepositoryAdapter,
		},
		{
			provide: I_COVER_REPOSITORY,
			useClass: TypeOrmCoverRepositoryAdapter,
		},
		{ provide: I_PAGE_REPOSITORY, useClass: TypeOrmPageRepositoryAdapter },
		{ provide: I_TAG_REPOSITORY, useClass: TypeOrmTagRepositoryAdapter },
		{
			provide: I_AUTHOR_REPOSITORY,
			useClass: TypeOrmAuthorRepositoryAdapter,
		},
		{
			provide: I_SENSITIVE_CONTENT_REPOSITORY,
			useClass: TypeOrmSensitiveContentRepositoryAdapter,
		},
		{
			provide: I_BOOK_RELATIONSHIP_REPOSITORY,
			useClass: TypeOrmBookRelationshipRepositoryAdapter,
		},
		{
			provide: I_CHAPTER_READ_REPOSITORY,
			useClass: TypeOrmChapterReadRepositoryAdapter,
		},
		{
			provide: I_CHAPTER_COMMENT_REPOSITORY,
			useClass: TypeOrmChapterCommentRepositoryAdapter,
		},
		{
			provide: I_UNIT_OF_WORK,
			useClass: TypeOrmUnitOfWorkAdapter,
		},
		BooksService,
		BookScrapingEvents,
		BookInitEvents,
		ChapterService,
		ChapterCommentsService,
		SensitiveContentService,
		TagsService,
		ChapterScrapingJob,
		ChapterScrapingService,
		ChapterScrapingSharedService,
		CoverImageService,
		CoverImageProcessor,
		FixChapterService,
		FixChapterProcessor,
		// Book Update Jobs
		BookUpdateJobService,
		BookUpdateProcessor,
		BookUpdateScheduler,
		// serviços especializados
		BookCreationService,
		BookUpdateService,
		BookBookRelationshipService,
		BookContentUpdateService,
		BookQueryService,
		ChapterManagementService,
		BookRelationshipService,
		BookUploadService,
		BookDeletionService,
		// Listeners
		FileDeletionEvents,
		// WebSocket Gateway
		BooksGateway,
		BookResolver,
	],
	exports: [
		I_BOOK_REPOSITORY,
		I_CHAPTER_REPOSITORY,
		I_COVER_REPOSITORY,
		I_PAGE_REPOSITORY,
		I_TAG_REPOSITORY,
		I_AUTHOR_REPOSITORY,
		I_SENSITIVE_CONTENT_REPOSITORY,
		I_BOOK_RELATIONSHIP_REPOSITORY,
		I_CHAPTER_READ_REPOSITORY,
		I_CHAPTER_COMMENT_REPOSITORY,
		I_UNIT_OF_WORK,
		ChapterCommentsService,
		ChapterService,
	],
})
export class BooksModule {}
