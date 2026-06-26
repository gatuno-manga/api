import { BooksModule } from '@/books/books.module';
import { AddBookToCollectionUseCase } from '@/collections/application/use-cases/add-book-to-collection.use-case';
import { CreateCollectionUseCase } from '@/collections/application/use-cases/create-collection.use-case';
import { DeleteCollectionUseCase } from '@/collections/application/use-cases/delete-collection.use-case';
import { GetCollectionBookCoversUseCase } from '@/collections/application/use-cases/get-collection-book-covers.use-case';
import { GetCollectionsForSyncUseCase } from '@/collections/application/use-cases/get-collections-for-sync.use-case';
import { GetPublicCollectionsUseCase } from '@/collections/application/use-cases/get-public-collections.use-case';
import { ProcessSyncPushCollectionUseCase } from '@/collections/application/use-cases/process-sync-push-collection.use-case';
import { RestoreCollectionUseCase } from '@/collections/application/use-cases/restore-collection.use-case';
import { UpdateCollectionCoverUseCase } from '@/collections/application/use-cases/update-collection-cover.use-case';
import { UpdateCollectionUseCase } from '@/collections/application/use-cases/update-collection.use-case';
import { UploadCollectionCoverUseCase } from '@/collections/application/use-cases/upload-collection-cover.use-case';
import { CollectionResolver } from '@/collections/infrastructure/graphql/resolvers/collection.resolver';
import { FilesModule } from '@/files/files.module';
import { SyncModule } from '@/sync/sync.module';
import { AuthModule } from '@auth/auth.module';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@users/infrastructure/database/entities/user.entity';
import { UsersModule } from '@users/users.module';
import { CollectionsSyncProvider } from './application/providers/collections-sync.provider';
import { GetUserCollectionsUseCase } from './application/use-cases/get-user-collections.use-case';
import { ShareCollectionUseCase } from './application/use-cases/share-collection.use-case';
import { CollectionsController } from './infrastructure/controllers/collections.controller';
import { CollectionEntity } from './infrastructure/database/entities/collection.entity';
import { TypeOrmCollectionRepository } from './infrastructure/database/repositories/typeorm-collection.repository';

@Module({
	imports: [
		forwardRef(() => AuthModule),
		forwardRef(() => UsersModule),
		forwardRef(() => BooksModule),
		forwardRef(() => SyncModule),
		FilesModule,
		TypeOrmModule.forFeature([CollectionEntity, User, Book]),
	],
	controllers: [CollectionsController],
	providers: [
		{
			provide: 'CollectionRepository',
			useClass: TypeOrmCollectionRepository,
		},
		CreateCollectionUseCase,
		DeleteCollectionUseCase,
		RestoreCollectionUseCase,
		GetCollectionsForSyncUseCase,
		ProcessSyncPushCollectionUseCase,
		AddBookToCollectionUseCase,
		ShareCollectionUseCase,
		GetUserCollectionsUseCase,
		GetPublicCollectionsUseCase,
		UpdateCollectionCoverUseCase,
		UploadCollectionCoverUseCase,
		UpdateCollectionUseCase,
		GetCollectionBookCoversUseCase,
		CollectionResolver,
	],
	exports: [
		'CollectionRepository',
		GetUserCollectionsUseCase,
		GetPublicCollectionsUseCase,
		CreateCollectionUseCase,
		DeleteCollectionUseCase,
		RestoreCollectionUseCase,
		GetCollectionsForSyncUseCase,
		ProcessSyncPushCollectionUseCase,
		AddBookToCollectionUseCase,
		UpdateCollectionCoverUseCase,
		UploadCollectionCoverUseCase,
		UpdateCollectionUseCase,
		GetCollectionBookCoversUseCase,
	],
})
export class CollectionsModule {}
