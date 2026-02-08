import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { AuthModule } from 'src/auth/auth.module';
import { Book } from 'src/books/entitys/book.entity';
import { Chapter } from 'src/books/entitys/chapter.entity';
import { Page } from 'src/books/entitys/page.entity';
import {
	CollectionBook,
	CollectionsBooksController,
	CollectionsBooksService,
} from './collections-books';
import { ReadingProgress } from './entitys/reading-progress.entity';
import { Role } from './entitys/role.entity';
import { User } from './entitys/user.entity';
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

@Module({
	imports: [
		AuthModule,
		AppConfigModule,
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
	],
})
export class UsersModule {}
