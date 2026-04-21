import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from 'src/infrastructure/app-config/app-config.module';
import { AuthModule } from 'src/auth/auth.module';
import { Book } from 'src/books/entities/book.entity';
import { Chapter } from 'src/books/entities/chapter.entity';
import { Cover } from 'src/books/entities/cover.entity';
import { Page } from 'src/books/entities/page.entity';
import { NoCompressionAdapter } from './infrastructure/adapters/no-compression.adapter';
import { SharpAdapter } from './infrastructure/adapters/sharp.adapter';
import { FileCompressorFactory } from './infrastructure/adapters/file-compressor.factory';
import { IFileCompressor } from './application/ports/file-compressor.interface';
import { FileCleanupController } from './infrastructure/controllers/file-cleanup.controller';
import { FileCleanupCron } from './infrastructure/framework/file-cleanup.cron';
import { FileCleanupService } from './application/services/file-cleanup.service';
import { FilesService } from './application/services/files.service';

@Module({
	controllers: [FileCleanupController],
	providers: [
		FilesService,
		FileCleanupService,
		FileCleanupCron,
		FileCompressorFactory,
		SharpAdapter,
		NoCompressionAdapter,
		{
			provide: 'FILE_COMPRESSORS',
			useFactory: (
				sharpAdapter: SharpAdapter,
				noCompressionAdapter: NoCompressionAdapter,
			) => {
				return [
					sharpAdapter,
					noCompressionAdapter, // Fallback para outros tipos
				];
			},
			inject: [SharpAdapter, NoCompressionAdapter],
		},
		{
			provide: 'COMPRESSOR_FACTORY_INIT',
			useFactory: (
				factory: FileCompressorFactory,
				compressors: IFileCompressor[],
			) => {
				factory.registerCompressors(compressors);
				return factory;
			},
			inject: [FileCompressorFactory, 'FILE_COMPRESSORS'],
		},
	],
	imports: [
		AppConfigModule,
		AuthModule,
		TypeOrmModule.forFeature([Page, Cover, Book, Chapter]),
	],
	exports: [FilesService, FileCleanupService],
})
export class FilesModule {}
