import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '@app-config/app-config.module';
import { AuthModule } from '@auth/auth.module';
import { RedisModule } from '@api/infrastructure/redis/redis.module';
import { FilesModule } from '@src/files/files.module';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { Chapter } from '@books/infrastructure/database/entities/chapter.entity';
import { BookDownloadController } from '@books/infrastructure/http/controllers/book-download.controller';
import { ChapterDownloadController } from '@books/infrastructure/http/controllers/chapter-download.controller';
import { DownloadCacheService } from './download-cache.service';
import { DownloadService } from './download.service';
import { DocumentDownloadStrategy } from '@books/application/strategies/document-download.strategy';
import { MarkdownDownloadStrategy } from '@books/application/strategies/markdown-download.strategy';
import { PdfStrategy } from '@books/application/strategies/pdf.strategy';
import { PdfsZipStrategy } from '@books/application/strategies/pdfs-zip.strategy';
import { ZipStrategy } from '@books/application/strategies/zip.strategy';

@Module({
	imports: [
		TypeOrmModule.forFeature([Chapter, Book]),
		RedisModule,
		AuthModule,
		AppConfigModule,
		FilesModule,
	],
	controllers: [ChapterDownloadController, BookDownloadController],
	providers: [
		DownloadService,
		DownloadCacheService,
		ZipStrategy,
		PdfStrategy,
		PdfsZipStrategy,
		DocumentDownloadStrategy,
		MarkdownDownloadStrategy,
	],
	exports: [DownloadService],
})
export class DownloadModule {}
