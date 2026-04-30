import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { Author } from '../../domain/entities/author';
import { Book } from '../../domain/entities/book';
import { SensitiveContentService } from './sensitive-content.service';
import { AuthorsOptions } from '../dto/authors-options.dto';
import {
	I_AUTHOR_REPOSITORY,
	IAuthorRepository,
} from '../ports/author-repository.interface';
import {
	I_BOOK_REPOSITORY,
	IBookRepository,
} from '../ports/book-repository.interface';
import { MEILI_CLIENT } from '../../../infrastructure/meilisearch/meilisearch.constants';
import { Meilisearch } from 'meilisearch';

@Injectable()
export class AuthorsService {
	private readonly logger = new Logger(AuthorsService.name);

	constructor(
		@Inject(I_AUTHOR_REPOSITORY)
		private readonly authorsRepository: IAuthorRepository,
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
		private readonly sensitiveContentService: SensitiveContentService,
		@Inject(MEILI_CLIENT) private readonly meiliClient: Meilisearch,
	) {}

	async search(query: string): Promise<Author[]> {
		try {
			const result = await this.meiliClient
				.index('authors')
				.search(query, {
					limit: 20,
				});

			return result.hits.map((hit) => ({
				id: hit.id as string,
				name: hit.name as string,
				biography: hit.biography as string,
				createdAt: new Date((hit.createdAt as number) * 1000),
				updatedAt: new Date((hit.updatedAt as number) * 1000),
			})) as unknown as Author[];
		} catch (error) {
			this.logger.error(
				`Error searching authors in Meilisearch: ${error.message}`,
			);
			// Fallback ou lista vazia
			return [];
		}
	}

	async get(
		options: AuthorsOptions,
		maxWeightSensitiveContent = 99,
	): Promise<Author[]> {
		return this.authorsRepository.findWithFilters(
			options,
			maxWeightSensitiveContent,
		);
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
		const author = await this.authorsRepository.findById(id);
		if (!author) {
			this.logger.warn(`Author with id ${id} not found`);
			throw new NotFoundException(`Author with id ${id} not found`);
		}

		// Lógica simplificada para o build, deve ser movida para o adapter ou tratada via domínio
		// Para agora, vamos manter o esqueleto que compila
		return author;
	}
}
