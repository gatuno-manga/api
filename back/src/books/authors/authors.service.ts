import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Author } from '../entities/author.entity';
import { Book } from '../entities/book.entity';
import { SensitiveContentService } from '../sensitive-content/sensitive-content.service';
import { AuthorsOptions } from './dto/authors-options.dto';

@Injectable()
export class AuthorsService {
	private readonly logger = new Logger(AuthorsService.name);

	constructor(
		@InjectRepository(Author)
		private readonly authorsRepository: Repository<Author>,
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		private readonly sensitiveContentService: SensitiveContentService,
	) {}

	async get(
		options: AuthorsOptions,
		maxWeightSensitiveContent = 99,
	): Promise<Author[]> {
		const queryBuilder = this.bookRepository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.authors', 'author')
			.leftJoin('book.sensitiveContent', 'sensitiveContent');

		await this.sensitiveContentService.filterBooksSensitiveContent(
			queryBuilder,
			options.sensitiveContent,
			maxWeightSensitiveContent,
		);
		const books = await queryBuilder.getMany();

		const authorIds = Array.from(
			new Set(
				books.flatMap((book) =>
					book.authors.map((author) => author.id),
				),
			),
		);
		return this.authorsRepository.find({
			where: { id: In(authorIds) },
			order: { name: 'ASC' },
		});
	}

	async getAll(
		options: AuthorsOptions,
		maxWeightSensitiveContent = 99,
	): Promise<Author[]> {
		const allSensitiveContent = await this.sensitiveContentService.getAll(
			maxWeightSensitiveContent,
		);
		options.sensitiveContent = allSensitiveContent.map((sc) => sc.name);
		return this.get(options, maxWeightSensitiveContent);
	}

	async mergeAuthors(id: string, copy: string[]) {
		const author = await this.authorsRepository.findOne({
			where: { id },
		});
		if (!author) {
			this.logger.warn(`Author with id ${id} not found`);
			throw new NotFoundException(`Author with id ${id} not found`);
		}
		const copyAuthors = await this.authorsRepository.find({
			where: { id: In(copy) },
		});
		if (copyAuthors.length === 0) {
			this.logger.warn(`No authors found for ids: ${copy.join(', ')}`);
			throw new NotFoundException(
				`No authors found for ids: ${copy.join(', ')}`,
			);
		}
		const books = await this.bookRepository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.authors', 'author')
			.where('author.id IN (:...copyIds)', { copyIds: copy })
			.getMany();

		for (const book of books) {
			book.authors = book.authors.filter((a) => !copy.includes(a.id));
			if (!book.authors.some((a) => a.id === id)) {
				book.authors.push(author);
			}
			await this.bookRepository.save(book);
		}

		await this.authorsRepository.remove(copyAuthors);
		return author;
	}
}
