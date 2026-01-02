import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChapterDownloadController } from './chapter-download.controller';
import { BookDownloadController } from './book-download.controller';
import { DownloadService } from './download.service';
import { DownloadCacheService } from './download-cache.service';
import { ZipStrategy } from './strategies/zip.strategy';
import { PdfStrategy } from './strategies/pdf.strategy';
import { Chapter } from '../entitys/chapter.entity';
import { Book } from '../entitys/book.entity';
import { RedisModule } from 'src/redis/redis.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Chapter, Book]),
        RedisModule,
        AuthModule,
    ],
    controllers: [ChapterDownloadController, BookDownloadController],
    providers: [
        DownloadService,
        DownloadCacheService,
        ZipStrategy,
        PdfStrategy,
    ],
    exports: [DownloadService],
})
export class DownloadModule {}
