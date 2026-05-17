import { AuthModule } from '@auth/auth.module';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@users/infrastructure/database/entities/user.entity';
import { AddBookToCollectionUseCase } from './application/use-cases/add-book-to-collection.use-case';
import { CreateCollectionUseCase } from './application/use-cases/create-collection.use-case';
import { GetPublicCollectionsUseCase } from './application/use-cases/get-public-collections.use-case';
import { GetUserCollectionsUseCase } from './application/use-cases/get-user-collections.use-case';
import { ShareCollectionUseCase } from './application/use-cases/share-collection.use-case';
import { CollectionsController } from './infrastructure/controllers/collections.controller';
import { CollectionEntity } from './infrastructure/database/entities/collection.entity';
import { TypeOrmCollectionRepository } from './infrastructure/database/repositories/typeorm-collection.repository';

@Module({
	imports: [
		AuthModule,
		TypeOrmModule.forFeature([CollectionEntity, User, Book]),
	],
	controllers: [CollectionsController],
	providers: [
		{
			provide: 'CollectionRepository',
			useClass: TypeOrmCollectionRepository,
		},
		CreateCollectionUseCase,
		AddBookToCollectionUseCase,
		ShareCollectionUseCase,
		GetUserCollectionsUseCase,
		GetPublicCollectionsUseCase,
	],
	exports: [
		'CollectionRepository',
		GetUserCollectionsUseCase,
		GetPublicCollectionsUseCase,
	],
})
export class CollectionsModule {}
