import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from 'src/auth/auth.module';
import { User } from './entitys/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from 'src/books/entitys/book.entity';
import { Role } from './entitys/role.entity';
import { CollectionBook } from './entitys/collection-book.entity';
import { CollectionBookController } from './coletion-book.controller';
import { CollectionBookService } from './coletion-book.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([User, Role, CollectionBook, Book])
  ],
  controllers: [UsersController, CollectionBookController],
  providers: [UsersService, CollectionBookService],
})
export class UsersModule {}
