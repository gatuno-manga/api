import { BooksModule } from '@/books/books.module';
import { AddBookToCollectionUseCase } from '@/collections/application/use-cases/add-book-to-collection.use-case';
import { CreateCollectionUseCase } from '@/collections/application/use-cases/create-collection.use-case';
import { DeleteCollectionUseCase } from '@/collections/application/use-cases/delete-collection.use-case';
import { GetPublicCollectionsUseCase } from '@/collections/application/use-cases/get-public-collections.use-case';
import { AuthModule } from '@auth/auth.module';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@users/infrastructure/database/entities/user.entity';
import { UsersModule } from '@users/users.module';
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
		AddBookToCollectionUseCase,
		ShareCollectionUseCase,
		GetUserCollectionsUseCase,
		GetPublicCollectionsUseCase,
	],
	exports: [
		'CollectionRepository',
		GetUserCollectionsUseCase,
		GetPublicCollectionsUseCase,
		CreateCollectionUseCase,
		DeleteCollectionUseCase,
		AddBookToCollectionUseCase,
	],
})
export class CollectionsModule {}
