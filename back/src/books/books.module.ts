import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { AuthModule } from 'src/auth/auth.module';
import { ChapterRead } from 'src/books/entities/chapter-read.entity';
import { FilesModule } from 'src/files/files.module';
import { LoggingModule } from 'src/logging/logging.module';
import { MetricsModule } from 'src/metrics/metrics.module';
import { ScrapingModule } from 'src/scraping/scraping.module';
import { AdminBooksDashboardController } from './admin-books-dashboard.controller';
import { AdminBooksUploadController } from './admin-books-upload.controller';
import { AdminBooksController } from './admin-books.controller';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { ChapterController } from './chapters/chapter.controller';
import { ChapterService } from './chapters/chapter.service';
import { DownloadModule } from './download/download.module';
import { Author } from './entities/author.entity';
import { Book } from './entities/book.entity';
import { Chapter } from './entities/chapter.entity';
import { Cover } from './entities/cover.entity';
import { Page } from './entities/page.entity';
import { SensitiveContent } from './entities/sensitive-content.entity';
import { Tag } from './entities/tags.entity';
import { BookInitEvents } from './events/book.init.events';
import { BookScrapingEvents } from './events/book.scraping.events';
import { FileDeletionEvents } from './events/file-deletion.events';
import { BooksGateway } from './gateway/books.gateway';
import { BookUpdateProcessor } from './jobs/book-update.processor';
import { BookUpdateScheduler } from './jobs/book-update.scheduler';
import { BookUpdateJobService } from './jobs/book-update.service';
import { ChapterScrapingJob } from './jobs/chapter-scraping.job';
import { ChapterScrapingService } from './jobs/chapter-scraping.service';
import { ChapterScrapingSharedService } from './jobs/chapter-scraping.shared';
import { CoverImageProcessor } from './jobs/cover-image.processor';
import { CoverImageService } from './jobs/cover-image.service';
import { FixChapterProcessor } from './jobs/fix-chapter.processor';
import { FixChapterService } from './jobs/fix-chapter.service';
import { SensitiveContentController } from './sensitive-content/sensitive-content.controller';
import { SensitiveContentService } from './sensitive-content/sensitive-content.service';
import { BookContentUpdateService } from './services/book-content-update.service';
import { BookCreationService } from './services/book-creation.service';
import { BookDeletionService } from './services/book-deletion.service';
import { BookQueryService } from './services/book-query.service';
import { BookRelationshipService } from './services/book-relationship.service';
import { BookUpdateService } from './services/book-update.service';
import { BookUploadService } from './services/book-upload.service';
import { ChapterManagementService } from './services/chapter-management.service';
import { TagsController } from './tags/tags.controller';
import { TagsService } from './tags/tags.service';

@Module({
	imports: [
		ScrapingModule,
		AppConfigModule,
		FilesModule,
		LoggingModule,
		MetricsModule,
		ScheduleModule.forRoot(),
		DownloadModule,
		TypeOrmModule.forFeature([
			Book,
			Page,
			Chapter,
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
		SensitiveContentController,
		TagsController,
		AdminBooksController,
		AdminBooksUploadController,
		AdminBooksDashboardController,
	],
	providers: [
		BooksService,
		BookScrapingEvents,
		BookInitEvents,
		ChapterService,
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
	],
})
export class BooksModule {}
