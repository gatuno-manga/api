import { CollectionsModule } from '@/collections/collections.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { Book } from 'src/books/infrastructure/database/entities/book.entity';
import { Chapter } from 'src/books/infrastructure/database/entities/chapter.entity';
import { Page } from 'src/books/infrastructure/database/entities/page.entity';
import { Tag } from 'src/books/infrastructure/database/entities/tags.entity';
import { FilesModule } from 'src/files/files.module';
import { AppConfigModule } from 'src/infrastructure/app-config/app-config.module';
import { EncryptionModule } from 'src/infrastructure/encryption/encryption.module';
import { UserResourcesMapper } from './application/mappers/user-resources.mapper';
import { I_USER_IMAGE_REPOSITORY } from './application/ports/user-image-repository.interface';
import { I_USER_REPOSITORY } from './application/ports/user-repository.interface';
import { HighestPageWinsStrategy } from './application/strategies/highest-page-wins.strategy';
import { LastWriteWinsStrategy } from './application/strategies/last-write-wins.strategy';
import { SyncStrategyResolver } from './application/strategies/sync-strategy.resolver';
import { AdminUsersService } from './application/use-cases/admin-users.service';
import { ReadingProgressService } from './application/use-cases/reading-progress.service';
import { UsersService } from './application/use-cases/users.service';
import { AdminAccessPoliciesController } from './infrastructure/controllers/admin-access-policies.controller';
import { AdminGroupsController } from './infrastructure/controllers/admin-groups.controller';
import { AdminRolesController } from './infrastructure/controllers/admin-roles.controller';
import { AdminUsersController } from './infrastructure/controllers/admin-users.controller';
import { ReadingProgressController } from './infrastructure/controllers/reading-progress.controller';
import {
	SavedPage,
	SavedPagesController,
	SavedPagesService,
} from './infrastructure/controllers/saved-pages.index';
import { UserBookSavedPagesController } from './infrastructure/controllers/user-book-saved-pages.controller';
import { UserPublicResourcesController } from './infrastructure/controllers/user-public-resources.controller';
import { UsersController } from './infrastructure/controllers/users.controller';
import { TypeOrmUserImageRepositoryAdapter } from './infrastructure/database/adapters/typeorm-user-image-repository.adapter';
import { TypeOrmUserRepositoryAdapter } from './infrastructure/database/adapters/typeorm-user-repository.adapter';
import { AccessPolicy } from './infrastructure/database/entities/access-policy.entity';
import { ReadingProgress } from './infrastructure/database/entities/reading-progress.entity';
import { Role } from './infrastructure/database/entities/role.entity';
import { UserGroup } from './infrastructure/database/entities/user-group.entity';
import { UserImage } from './infrastructure/database/entities/user-image.entity';
import { User } from './infrastructure/database/entities/user.entity';
import { ReadingProgressGateway } from './infrastructure/gateways/reading-progress.gateway';
import { UserImageResolver } from './infrastructure/graphql/resolvers/user-image.resolver';
import { UserResolver } from './infrastructure/graphql/resolvers/user.resolver';
import { ReadingProgressNotifier } from './infrastructure/notifiers/reading-progress.notifier';

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
		UserImageResolver,
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
