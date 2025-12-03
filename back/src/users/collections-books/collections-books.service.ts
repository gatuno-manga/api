import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Book } from "src/books/entitys/book.entity";
import { Repository } from "typeorm";
import { User } from "../entitys/user.entity";
import { CollectionBook } from "./entities/collection-book.entity";
import { CreateCollectionBookDto } from "./dto/create-collection-book.dto";
import { AddBookCollectionDto } from "./dto/add-book-collection.dto";

@Injectable()
export class CollectionsBooksService {
    constructor(
        @InjectRepository(Book)
        private readonly bookRepository: Repository<Book>,
        @InjectRepository(CollectionBook)
        private readonly collectionBookRepository: Repository<CollectionBook>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>
    ) {}

    private async validateUser(userId: string): Promise<User> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
        });
        if (!user) {
            throw new NotFoundException("User not found");
        }
        return user;
    }

    private async findCollectionOrFail(idCollection: string, userId: string, loadBooks = false): Promise<CollectionBook> {
        const collection = await this.collectionBookRepository.findOne({
            where: { id: idCollection, user: { id: userId } },
            relations: loadBooks ? ['books'] : [],
        });
        if (!collection) {
            throw new NotFoundException("Collection not found or does not belong to the user");
        }
        return collection;
    }

    async getCollections(userId: string) {
        await this.validateUser(userId);
        const collections = await this.collectionBookRepository.find({
            where: { user: { id: userId } },
        });
        return collections;
    }

    async getNameCollectionBooks(userId: string) {
        await this.validateUser(userId);
        const collections = await this.collectionBookRepository.find({
            where: { user: { id: userId } },
            select: ['id', 'title'],
        });
        return collections;
    }

    async createCollectionBook(dto: CreateCollectionBookDto, userId: string) {
        await this.validateUser(userId);
        const collection = this.collectionBookRepository.create({
            ...dto,
            user: { id: userId },
        });
        return this.collectionBookRepository.save(collection);
    }

    async addBookToCollection(dto: AddBookCollectionDto, idCollection: string, userId: string) {
        await this.validateUser(userId);
        const collection = await this.findCollectionOrFail(idCollection, userId, true);

        const books = await this.bookRepository.find({
            where: dto.idsBook.map((id) => ({ id })),
        });

        if (books.length !== dto.idsBook.length) {
            const foundIds = books.map(b => b.id);
            const notFoundIds = dto.idsBook.filter(id => !foundIds.includes(id));
            throw new NotFoundException(`Books not found: ${notFoundIds.join(', ')}`);
        }

        // Filtra livros que já estão na coleção para evitar duplicatas
        const existingBookIds = new Set(collection.books.map(b => b.id));
        const newBooks = books.filter(book => !existingBookIds.has(book.id));

        if (newBooks.length === 0) {
            throw new BadRequestException("All books are already in the collection");
        }

        collection.books = [...collection.books, ...newBooks];
        const savedCollection = await this.collectionBookRepository.save(collection);

        return {
            ...savedCollection,
            addedCount: newBooks.length,
            skippedCount: books.length - newBooks.length,
        };
    }

    async getCollectionBooks(userId: string, idCollection: string) {
        await this.validateUser(userId);
        return this.findCollectionOrFail(idCollection, userId, true);
    }

    async removeBookFromCollection(idCollection: string, idBook: string, userId: string) {
        await this.validateUser(userId);
        const collection = await this.findCollectionOrFail(idCollection, userId, true);

        const bookIndex = collection.books.findIndex(book => book.id === idBook);
        if (bookIndex === -1) {
            throw new NotFoundException("Book not found in the collection");
        }

        collection.books.splice(bookIndex, 1);
        return this.collectionBookRepository.save(collection);
    }

    async deleteCollection(idCollection: string, userId: string) {
        await this.validateUser(userId);
        const collection = await this.findCollectionOrFail(idCollection, userId);
        return this.collectionBookRepository.remove(collection);
    }
}
