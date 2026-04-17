import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { AuthModule } from 'src/auth/auth.module';
import { Book } from 'src/books/entities/book.entity';
import { Chapter } from 'src/books/entities/chapter.entity';
import { Page } from 'src/books/entities/page.entity';
import { Tag } from 'src/books/entities/tags.entity';
import { FilesModule } from 'src/files/files.module';
import { AdminAccessPoliciesController } from './admin-access-policies.controller';
import { AdminGroupsController } from './admin-groups.controller';
import { AdminRolesController } from './admin-roles.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import {
	CollectionBook,
	CollectionsBooksController,
	CollectionsBooksService,
} from './collections-books';
import { AccessPolicy } from './entities/access-policy.entity';
import { ReadingProgress } from './entities/reading-progress.entity';
import { Role } from './entities/role.entity';
import { UserGroup } from './entities/user-group.entity';
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
			Tag,
			UserGroup,
			AccessPolicy,
		]),
	],
	controllers: [
		UsersController,
		AdminUsersController,
		AdminRolesController,
		AdminGroupsController,
		AdminAccessPoliciesController,
		UserPublicResourcesController,
		UserBookSavedPagesController,
		CollectionsBooksController,
		ReadingProgressController,
		SavedPagesController,
	],
	providers: [
		UsersService,
		AdminUsersService,
		CollectionsBooksService,
		ReadingProgressService,
		ReadingProgressGateway,
		SavedPagesService,
		UserResourcesMapper,
		LastWriteWinsStrategy,
		HighestPageWinsStrategy,
		SyncStrategyResolver,
	],
	exports: [AdminUsersService],
})
export class UsersModule {}
