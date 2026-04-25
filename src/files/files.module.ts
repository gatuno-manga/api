import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from 'src/infrastructure/app-config/app-config.module';
import { AuthModule } from 'src/auth/auth.module';
import { Book } from 'src/books/infrastructure/database/entities/book.entity';
import { Chapter } from 'src/books/infrastructure/database/entities/chapter.entity';
import { Cover } from 'src/books/infrastructure/database/entities/cover.entity';
import { Page } from 'src/books/infrastructure/database/entities/page.entity';
import { User } from 'src/users/infrastructure/database/entities/user.entity';
import { UserImage } from 'src/users/infrastructure/database/entities/user-image.entity';
import { NoCompressionAdapter } from './infrastructure/adapters/no-compression.adapter';
import { SharpAdapter } from './infrastructure/adapters/sharp.adapter';
import { FileCompressorFactory } from './infrastructure/adapters/file-compressor.factory';
import { IFileCompressor } from './application/ports/file-compressor.interface';
import { FileCleanupController } from './infrastructure/controllers/file-cleanup.controller';
import { FilesController } from './infrastructure/controllers/files.controller';
import { FileCleanupCron } from './infrastructure/framework/file-cleanup.cron';
import { FileCleanupService } from './application/services/file-cleanup.service';
import { FilesService } from './application/services/files.service';
import { S3StorageAdapter } from './infrastructure/adapters/s3-storage.adapter';
import { KafkaEventPublisherAdapter } from './infrastructure/adapters/kafka-event-publisher.adapter';
import { ImageProcessingController } from './infrastructure/controllers/image-processing.controller';

@Module({
	controllers: [
		FileCleanupController,
		FilesController,
		ImageProcessingController,
	],
	providers: [
		FilesService,
		FileCleanupService,
		FileCleanupCron,
		FileCompressorFactory,
		SharpAdapter,
		NoCompressionAdapter,
		S3StorageAdapter,
		KafkaEventPublisherAdapter,
		{
			provide: 'STORAGE_PORT',
			useClass: S3StorageAdapter,
		},
		{
			provide: 'EVENT_PUBLISHER_PORT',
			useClass: KafkaEventPublisherAdapter,
		},
		{
			provide: 'FILE_COMPRESSORS',
			useFactory: (noCompressionAdapter: NoCompressionAdapter) => {
				return [
					noCompressionAdapter, // Único ativo localmente agora
				];
			},
			inject: [NoCompressionAdapter],
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
		TypeOrmModule.forFeature([Page, Cover, Book, Chapter, User, UserImage]),
	],
	exports: [FilesService, FileCleanupService],
})
export class FilesModule {}
