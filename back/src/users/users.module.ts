import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { Book } from 'src/books/entitys/book.entity';
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

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([User, Role, CollectionBook, Book, ReadingProgress])
  ],
  controllers: [UsersController, CollectionsBooksController, ReadingProgressController],
  providers: [UsersService, CollectionsBooksService, ReadingProgressService, ReadingProgressGateway],
})
export class UsersModule {}
