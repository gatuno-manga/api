import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { ColetionBookService } from './coletion-book.service';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { CreateColetionBookDto } from './dto/create-coletion-book.dto';
import { addBookColetionDto } from './dto/add-book-coletion.dto';

@Controller('coletions')
@UseGuards(JwtAuthGuard)
export class coletionBookController {
  constructor(private readonly ColetionBookService: ColetionBookService) {}

  @Get()
  async getCollectionBooks(@CurrentUser() user: CurrentUserDto) {
    return this.ColetionBookService.getCollections(user.userId);
  }

  @Get('names')
  async getNameCollectionBooks(@CurrentUser() user: CurrentUserDto) {
    return this.ColetionBookService.getNameCollectionBooks(user.userId);
  }

  @Get(':idCollection')
  async getCollectionById(
    @Param('idCollection') idCollection: string,
    @CurrentUser() user: CurrentUserDto
  ) {
    return this.ColetionBookService.getCollectionBooks(user.userId, idCollection);
  }


  @Post()
  async createCollectionBook(
    @Body() dto: CreateColetionBookDto,
    @CurrentUser() user: CurrentUserDto
  ) {
    return this.ColetionBookService.createCollectionBook(dto, user.userId);
  }

  @Post(':idCollection/books')
  async addBookToCollection(
    @Body() dto: addBookColetionDto,
    @Param('idCollection') idCollection: string,
    @CurrentUser() user: CurrentUserDto
  ) {
    return this.ColetionBookService.addBookToCollection(dto, idCollection, user.userId);
  }


  @Delete(':idCollection/books/:idBook')
  async removeBookFromCollection(
    @Param('idCollection') idCollection: string,
    @Param('idBook') idBook: string,
    @CurrentUser() user: CurrentUserDto
  ) {
    return this.ColetionBookService.removeBookFromCollection(idCollection, idBook, user.userId);
  }

  @Delete(':idCollection')
  async deleteCollection(
    @Param('idCollection') idCollection: string,
    @CurrentUser() user: CurrentUserDto
  ) {
    return this.ColetionBookService.deleteCollection(idCollection, user.userId);
  }
}
