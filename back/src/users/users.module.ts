import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { Book } from 'src/books/entitys/book.entity';
import { Chapter } from 'src/books/entitys/chapter.entity';
import { Page } from 'src/books/entitys/page.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entitys/user.entity';
import { Role } from './entitys/role.entity';
import { ReadingProgress } from './entitys/reading-progress.entity';
import { ReadingProgressService } from './reading-progress.service';
import { ReadingProgressController } from './reading-progress.controller';
import { ReadingProgressGateway } from './gateway/reading-progress.gateway';
import {
  CollectionsBooksController,
  CollectionsBooksService,
  CollectionBook
} from './collections-books';
import {
  SavedPagesController,
  SavedPagesService,
  SavedPage
} from './saved-pages';
import { AppConfigModule } from 'src/app-config/app-config.module';

@Module({
  imports: [
    AuthModule,
    AppConfigModule,
    TypeOrmModule.forFeature([User, Role, CollectionBook, Book, ReadingProgress, SavedPage, Chapter, Page])
  ],
  controllers: [UsersController, CollectionsBooksController, ReadingProgressController, SavedPagesController],
  providers: [UsersService, CollectionsBooksService, ReadingProgressService, ReadingProgressGateway, SavedPagesService],
})
export class UsersModule {}
