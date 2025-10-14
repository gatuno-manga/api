import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { Book } from 'src/books/entitys/book.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entitys/user.entity';
import { Role } from './entitys/role.entity';
import { 
  CollectionsBooksController, 
  CollectionsBooksService, 
  CollectionBook 
} from './collections-books';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([User, Role, CollectionBook, Book])
  ],
  controllers: [UsersController, CollectionsBooksController],
  providers: [UsersService, CollectionsBooksService],
})
export class UsersModule {}
