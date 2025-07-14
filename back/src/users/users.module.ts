import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from 'src/auth/auth.module';
import { coletionBookController } from './coletion-book.controller';
import { ColetionBookService } from './coletion-book.service';
import { User } from './entitys/user.entity';
import { ColectionBook } from './entitys/coletion-book.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from 'src/books/entitys/book.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([User, ColectionBook, Book])
  ],
  controllers: [UsersController, coletionBookController],
  providers: [UsersService, ColetionBookService],
})
export class UsersModule {}
