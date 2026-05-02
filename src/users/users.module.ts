import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from 'src/infrastructure/app-config/app-config.module';
import { AuthModule } from 'src/auth/auth.module';
import { Book } from 'src/books/infrastructure/database/entities/book.entity';
import { Chapter } from 'src/books/infrastructure/database/entities/chapter.entity';
import { Page } from 'src/books/infrastructure/database/entities/page.entity';
import { Tag } from 'src/books/infrastructure/database/entities/tags.entity';
import { FilesModule } from 'src/files/files.module';
import { CollectionsModule } from '../collections/collections.module';
import { EncryptionModule } from 'src/infrastructure/encryption/encryption.module';
import { AdminAccessPoliciesController } from './infrastructure/controllers/admin-access-policies.controller';
import { AdminGroupsController } from './infrastructure/controllers/admin-groups.controller';
import { AdminRolesController } from './infrastructure/controllers/admin-roles.controller';
import { AdminUsersController } from './infrastructure/controllers/admin-users.controller';
import { AdminUsersService } from './application/use-cases/admin-users.service';
import { AccessPolicy } from './infrastructure/database/entities/access-policy.entity';
import { ReadingProgress } from './infrastructure/database/entities/reading-progress.entity';
import { Role } from './infrastructure/database/entities/role.entity';
import { UserGroup } from './infrastructure/database/entities/user-group.entity';
import { User } from './infrastructure/database/entities/user.entity';
import { UserImage } from './infrastructure/database/entities/user-image.entity';
import { ReadingProgressGateway } from './infrastructure/gateways/reading-progress.gateway';
import { ReadingProgressNotifier } from './infrastructure/notifiers/reading-progress.notifier';
import { ReadingProgressController } from './infrastructure/controllers/reading-progress.controller';
import { ReadingProgressService } from './application/use-cases/reading-progress.service';
import {
	SavedPage,
	SavedPagesController,
	SavedPagesService,
} from './infrastructure/controllers/saved-pages.index';
import { UsersController } from './infrastructure/controllers/users.controller';
import { UsersService } from './application/use-cases/users.service';
import { HighestPageWinsStrategy } from './application/strategies/highest-page-wins.strategy';
import { LastWriteWinsStrategy } from './application/strategies/last-write-wins.strategy';
import { SyncStrategyResolver } from './application/strategies/sync-strategy.resolver';
import { UserPublicResourcesController } from './infrastructure/controllers/user-public-resources.controller';
import { UserResourcesMapper } from './application/mappers/user-resources.mapper';
import { UserBookSavedPagesController } from './infrastructure/controllers/user-book-saved-pages.controller';
import { I_USER_REPOSITORY } from './application/ports/user-repository.interface';
import { TypeOrmUserRepositoryAdapter } from './infrastructure/database/adapters/typeorm-user-repository.adapter';
import { I_USER_IMAGE_REPOSITORY } from './application/ports/user-image-repository.interface';
import { TypeOrmUserImageRepositoryAdapter } from './infrastructure/database/adapters/typeorm-user-image-repository.adapter';
import { UserResolver } from './infrastructure/graphql/resolvers/user.resolver';

@Module({
	imports: [
		AuthModule,
		AppConfigModule,
		EncryptionModule,
		FilesModule,
		CollectionsModule,
		TypeOrmModule.forFeature([
			User,
			UserImage,
			Role,
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
		ReadingProgressController,
		SavedPagesController,
	],
	providers: [
		{ provide: I_USER_REPOSITORY, useClass: TypeOrmUserRepositoryAdapter },
		{
			provide: I_USER_IMAGE_REPOSITORY,
			useClass: TypeOrmUserImageRepositoryAdapter,
		},
		UsersService,
		AdminUsersService,
		ReadingProgressService,
		ReadingProgressGateway,
		ReadingProgressNotifier,
		SavedPagesService,
		UserResourcesMapper,
		LastWriteWinsStrategy,
		HighestPageWinsStrategy,
		SyncStrategyResolver,
		UserResolver,
	],
	exports: [
		AdminUsersService,
		I_USER_REPOSITORY,
		I_USER_IMAGE_REPOSITORY,
		ReadingProgressService,
		SavedPagesService,
	],
})
export class UsersModule {}
