import { Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { ScrapingModule } from 'src/scraping/scraping.module';
import { Page } from './entitys/page.entity';
import { Book } from './entitys/book.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chapter } from './entitys/chapter.entity';
import { BookScrapingEvents } from './events/book.scraping.events';
import { Tag } from './entitys/tags.entity';
import { Author } from './entitys/author.entity';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { BookInitEvents } from './events/book.init.events';
import { ChapterRead } from 'src/books/entitys/chapter-read.entity';
import { AuthModule } from 'src/auth/auth.module';
import { SensitiveContent } from './entitys/sensitive-content.entity';
import { ChapterController } from './chapters/chapter.controller';
import { ChapterService } from './chapters/chapter.service';
import { TagsController } from './tags/tags.controller';
import { SensitiveContentController } from './sensitive-content/sensitive-content.controller';
import { SensitiveContentService } from './sensitive-content/sensitive-content.service';
import { TagsService } from './tags/tags.service';
import { BullModule } from '@nestjs/bullmq';
import { ChapterScrapingJob } from './jobs/chapter-scraping.job';
import { ChapterScrapingService } from './jobs/chapter-scraping.service';
import { CoverImageService } from './jobs/cover-image.service';
import { CoverImageProcessor } from './jobs/cover-image.processor';
import { FixChapterService } from './jobs/fix-chapter.service';
import { FixChapterProcessor } from './jobs/fix-chapter.processor';
import { AdminBooksController } from './admin-books.controller';
import { Cover } from './entitys/cover.entity';
import { BookCreationService } from './services/book-creation.service';
import { BookUpdateService } from './services/book-update.service';
import { BookQueryService } from './services/book-query.service';
import { ChapterManagementService } from './services/chapter-management.service';
import { BookRelationshipService } from './services/book-relationship.service';
import { BooksGateway } from './gateway/books.gateway';
import { BookUploadService } from './services/book-upload.service';
import { FilesModule } from 'src/files/files.module';

@Module({
	imports: [
		ScrapingModule,
		AppConfigModule,
		FilesModule,
		TypeOrmModule.forFeature([
			Book,
			Page,
			Chapter,
			Tag,
			Author,
			ChapterRead,
			SensitiveContent,
			Cover
		]),
		AuthModule,
		BullModule.registerQueue(
			{
				name: 'chapter-scraping',
				defaultJobOptions: {
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
					removeOnFail: 10,
					delay: 10000,
					backoff: {
						type: 'exponential',
						delay: 5000,
					},
				},
			},
		),
	],
	controllers: [BooksController, ChapterController, SensitiveContentController, TagsController, AdminBooksController],
	providers: [
		BooksService,
		BookScrapingEvents,
		BookInitEvents,
		ChapterService,
		SensitiveContentService,
		TagsService,
		ChapterScrapingJob,
		ChapterScrapingService,
		CoverImageService,
		CoverImageProcessor,
		FixChapterService,
		FixChapterProcessor,
		// serviços especializados
		BookCreationService,
		BookUpdateService,
		BookQueryService,
		ChapterManagementService,
		BookRelationshipService,
		BookUploadService,
		// WebSocket Gateway
		BooksGateway,
	],
})
export class BooksModule {}
