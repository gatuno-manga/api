import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Book } from "src/books/entitys/book.entity";
import { Repository } from "typeorm";
import { ColectionBook } from "./entitys/coletion-book.entity";
import { CreateColetionBookDto } from "./dto/create-coletion-book.dto";
import { User } from "./entitys/user.entity";
import { addBookColetionDto } from "./dto/add-book-coletion.dto";

@Injectable()
export class ColetionBookService {
  constructor(
    @InjectRepository(Book)
    private readonly bookRepository: Repository<Book>,
    @InjectRepository(ColectionBook)
    private readonly coletionBookRepository: Repository<ColectionBook>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>
  ) {}

  private async ValidateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new BadRequestException("User not found");
    }
    return user;
  }

  async getCollections(userId: string) {
    this.ValidateUser(userId);
    const collections = await this.coletionBookRepository.find({
      where: { user: { id: userId } },
    });
    return collections;
  }

  async getNameCollectionBooks(userId: string) {
    this.ValidateUser(userId);
    const collections = await this.coletionBookRepository.find({
      where: { user: { id: userId } },
      select: ['id', 'title'],
    });
    return collections;
  }

  async createCollectionBook(dto: CreateColetionBookDto, userId: string) {
    this.ValidateUser(userId);
    const collection = this.coletionBookRepository.create({
      ...dto,
      user: { id: userId },
    });
    return this.coletionBookRepository.save(collection);
  }

  async addBookToCollection(dto: addBookColetionDto, idCollection: string, userId: string) {
    this.ValidateUser(userId);
    const collection = await this.coletionBookRepository.findOne({
      where: { id: idCollection, user: { id: userId } },
      relations: ['books'],
    });
    if (!collection) {
      throw new BadRequestException("Collection not found or does not belong to the user");
    }
    const books = await this.bookRepository.find({
      where: dto.idsBook.map((id) => ({ id })),
    });
    if (books.length !== dto.idsBook.length) {
      throw new BadRequestException("Some books not found");
    }

    return this.coletionBookRepository.save(
      this.coletionBookRepository.merge(collection, {
        books: [...collection.books, ...books],
      })
    );
  }

  async getCollectionBooks(userId: string, idCollection: string) {
    this.ValidateUser(userId);
    const collection = await this.coletionBookRepository.findOne({
      where: { id: idCollection, user: { id: userId } },
      relations: ['books'],
    });
    if (!collection) {
      throw new BadRequestException("Collection not found or does not belong to the user");
    }
    return collection;
  }

  async removeBookFromCollection(idCollection: string, idBook: string, userId: string) {
    this.ValidateUser(userId);
    const collection = await this.coletionBookRepository.findOne({
      where: { id: idCollection, user: { id: userId } },
      relations: ['books'],
    });
    if (!collection) {
      throw new BadRequestException("Collection not found or does not belong to the user");
    }
    const bookIndex = collection.books.findIndex(book => book.id === idBook);
    if (bookIndex === -1) {
      throw new BadRequestException("Book not found in the collection");
    }
    collection.books.splice(bookIndex, 1);
    return this.coletionBookRepository.save(collection);
  }

  async deleteCollection(idCollection: string, userId: string) {
    this.ValidateUser(userId);
    const collection = await this.coletionBookRepository.findOne({
      where: { id: idCollection, user: { id: userId } },
    });
    if (!collection) {
      throw new BadRequestException("Collection not found or does not belong to the user");
    }
    return this.coletionBookRepository.remove(collection);
  }
}
