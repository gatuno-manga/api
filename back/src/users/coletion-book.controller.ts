import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { CollectionBookService } from './coletion-book.service';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { CreateCollectionBookDto } from './dto/create-collection-book.dto';
import { AddBookCollectionDto } from './dto/add-book-collection.dto';

@Controller('collections')
@UseGuards(JwtAuthGuard)
export class CollectionBookController {
  constructor(private readonly collectionBookService: CollectionBookService) {}

  @Get()
  async getCollectionBooks(@CurrentUser() user: CurrentUserDto) {
    return this.collectionBookService.getCollections(user.userId);
  }

  @Get('names')
  async getNameCollectionBooks(@CurrentUser() user: CurrentUserDto) {
    return this.collectionBookService.getNameCollectionBooks(user.userId);
  }

  @Get(':idCollection')
  async getCollectionById(
    @Param('idCollection') idCollection: string,
    @CurrentUser() user: CurrentUserDto
  ) {
    return this.collectionBookService.getCollectionBooks(user.userId, idCollection);
  }


  @Post()
  async createCollectionBook(
    @Body() dto: CreateCollectionBookDto,
    @CurrentUser() user: CurrentUserDto
  ) {
    return this.collectionBookService.createCollectionBook(dto, user.userId);
  }

  @Post(':idCollection/books')
  async addBookToCollection(
    @Body() dto: AddBookCollectionDto,
    @Param('idCollection') idCollection: string,
    @CurrentUser() user: CurrentUserDto
  ) {
    return this.collectionBookService.addBookToCollection(dto, idCollection, user.userId);
  }


  @Delete(':idCollection/books/:idBook')
  async removeBookFromCollection(
    @Param('idCollection') idCollection: string,
    @Param('idBook') idBook: string,
    @CurrentUser() user: CurrentUserDto
  ) {
    return this.collectionBookService.removeBookFromCollection(idCollection, idBook, user.userId);
  }

  @Delete(':idCollection')
  async deleteCollection(
    @Param('idCollection') idCollection: string,
    @CurrentUser() user: CurrentUserDto
  ) {
    return this.collectionBookService.deleteCollection(idCollection, user.userId);
  }
}
