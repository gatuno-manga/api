import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { AuthModule } from 'src/auth/auth.module';
import { Book } from 'src/books/entities/book.entity';
import { Chapter } from 'src/books/entities/chapter.entity';
import { Page } from 'src/books/entities/page.entity';
import { FilesModule } from 'src/files/files.module';
import {
	CollectionBook,
	CollectionsBooksController,
	CollectionsBooksService,
} from './collections-books';
import { ReadingProgress } from './entities/reading-progress.entity';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import { ReadingProgressGateway } from './gateway/reading-progress.gateway';
import { ReadingProgressController } from './reading-progress.controller';
import { ReadingProgressService } from './reading-progress.service';
import {
	SavedPage,
	SavedPagesController,
	SavedPagesService,
} from './saved-pages';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { HighestPageWinsStrategy } from './sync/highest-page-wins.strategy';
import { LastWriteWinsStrategy } from './sync/last-write-wins.strategy';
import { SyncStrategyResolver } from './sync/sync-strategy.resolver';
import { UserPublicResourcesController } from './user-public-resources.controller';
import { UserResourcesMapper } from './user-resources.mapper';
import { UserBookSavedPagesController } from './user-book-saved-pages.controller';

@Module({
	imports: [
		AuthModule,
		AppConfigModule,
		FilesModule,
		TypeOrmModule.forFeature([
			User,
			Role,
			CollectionBook,
			Book,
			ReadingProgress,
			SavedPage,
			Chapter,
			Page,
		]),
	],
	controllers: [
		UsersController,
		UserPublicResourcesController,
		UserBookSavedPagesController,
		CollectionsBooksController,
		ReadingProgressController,
		SavedPagesController,
	],
	providers: [
		UsersService,
		CollectionsBooksService,
		ReadingProgressService,
		ReadingProgressGateway,
		SavedPagesService,
		UserResourcesMapper,
		LastWriteWinsStrategy,
		HighestPageWinsStrategy,
		SyncStrategyResolver,
	],
})
export class UsersModule {}
