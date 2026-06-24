import { MEILI_CLIENT } from '@/infrastructure/meilisearch/meilisearch.constants';
import { AuthorsOptions } from '@books/application/dto/authors-options.dto';
import {
	IAuthorRepository,
	I_AUTHOR_REPOSITORY,
} from '@books/application/ports/author-repository.interface';
import {
	IBookRepository,
	I_BOOK_REPOSITORY,
} from '@books/application/ports/book-repository.interface';
import { resolveLocalizedField } from '@books/application/utils/localization.utils';
import { Author } from '@books/domain/entities/author';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Meilisearch } from 'meilisearch';
import { SensitiveContentService } from './sensitive-content.service';

@Injectable()
export class AuthorsService {
	private readonly logger = new Logger(AuthorsService.name);

	constructor(
		@Inject(I_AUTHOR_REPOSITORY)
		private readonly authorsRepository: IAuthorRepository,
		@Inject(I_BOOK_REPOSITORY) readonly _bookRepository: IBookRepository,
		private readonly sensitiveContentService: SensitiveContentService,
		@Inject(MEILI_CLIENT) private readonly meiliClient: Meilisearch,
	) {}

	/**
	 * Mapeia e resolve campos localizados para um autor
	 */
	private mapAuthorLocalizations(
		author: Author,
		targetLang?: string,
	): Author {
		const lang = targetLang || 'pt-BR';

		const bestBio = resolveLocalizedField(
			author.localizedBiographies,
			lang,
			null,
			'pt-BR',
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			(item: any) => item.biography,
		);
		if (bestBio) {
			author.biography = bestBio.biography;
		}

		return author;
	}

	async search(query: string, targetLang?: string): Promise<Author[]> {
		try {
			const result = await this.meiliClient
				.index('authors')
				.search(query, {
					limit: 20,
				});

			// Note: Search from Meilisearch might need full fetching for localizedBiographies
			// if we want to resolve it here. For simplicity, we'll map what's in the hit
			// or fetch from repo if needed. For now, just map hits.
			return result.hits.map((hit) => {
				const author = {
					id: hit.id as string,
					name: hit.name as string,
					biography: hit.biography as string,
					localizedBiographies:
						(hit.localizedBiographies as Record<
							string,
							unknown
						>[]) || [],
					createdAt: new Date((hit.createdAt as number) * 1000),
					updatedAt: new Date((hit.updatedAt as number) * 1000),
				} as unknown as Author;
				return this.mapAuthorLocalizations(author, targetLang);
			});
		} catch (error: unknown) {
			this.logger.error(
				`Error searching authors in Meilisearch: ${error instanceof Error ? error.message : String(error)}`,
			);
			return [];
		}
	}

	async get(
		options: AuthorsOptions,
		maxWeightSensitiveContent = 99,
		targetLang?: string,
	): Promise<Author[]> {
		const authors = await this.authorsRepository.findWithFilters(
			options,
			maxWeightSensitiveContent,
		);
		return authors.map((a) => this.mapAuthorLocalizations(a, targetLang));
	}

	async getAll(
		options: AuthorsOptions,
		maxWeightSensitiveContent = 99,
		targetLang?: string,
	): Promise<Author[]> {
		const allSensitiveContent = await this.sensitiveContentService.getAll(
			maxWeightSensitiveContent,
		);
		options.sensitiveContent = allSensitiveContent.map((sc) => sc.name);
		return this.get(options, maxWeightSensitiveContent, targetLang);
	}

	async mergeAuthors(id: string, _copy: string[]) {
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
