import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesService } from './files.service';
import { FileCleanupService } from './file-cleanup.service';
import { FileCleanupController } from './file-cleanup.controller';
import { FileCleanupCron } from './file-cleanup.cron';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { AuthModule } from 'src/auth/auth.module';
import { SharpAdapter } from './adapters/sharp.adapter';
import { NoCompressionAdapter } from './adapters/no-compression.adapter';
import { FileCompressorFactory } from './factories/file-compressor.factory';
import { Page } from 'src/books/entitys/page.entity';
import { Cover } from 'src/books/entitys/cover.entity';
import { Book } from 'src/books/entitys/book.entity';
import { Chapter } from 'src/books/entitys/chapter.entity';

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
				compressors: any[],
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
