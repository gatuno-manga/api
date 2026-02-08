import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { AuthModule } from 'src/auth/auth.module';
import { RedisModule } from 'src/redis/redis.module';
import { Book } from '../entitys/book.entity';
import { Chapter } from '../entitys/chapter.entity';
import { BookDownloadController } from './book-download.controller';
import { ChapterDownloadController } from './chapter-download.controller';
import { DownloadCacheService } from './download-cache.service';
import { DownloadService } from './download.service';
import { DocumentDownloadStrategy } from './strategies/document-download.strategy';
import { MarkdownDownloadStrategy } from './strategies/markdown-download.strategy';
import { PdfStrategy } from './strategies/pdf.strategy';
import { PdfsZipStrategy } from './strategies/pdfs-zip.strategy';
import { ZipStrategy } from './strategies/zip.strategy';

@Module({
	imports: [
		TypeOrmModule.forFeature([Chapter, Book]),
		RedisModule,
		AuthModule,
		AppConfigModule,
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
