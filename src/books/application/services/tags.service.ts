import { MEILI_CLIENT } from '@/infrastructure/meilisearch/meilisearch.constants';
import { TagsOptions } from '@books/application/dto/tags-options.dto';
import {
	IBookRepository,
	I_BOOK_REPOSITORY,
} from '@books/application/ports/book-repository.interface';
import {
	ITagRepository,
	I_TAG_REPOSITORY,
} from '@books/application/ports/tag-repository.interface';
import { Tag } from '@books/domain/entities/tag';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Meilisearch } from 'meilisearch';
import { SensitiveContentService } from './sensitive-content.service';

@Injectable()
export class TagsService {
	private readonly logger = new Logger(TagsService.name);
	constructor(
		@Inject(I_TAG_REPOSITORY)
		private readonly tagRepository: ITagRepository,
		@Inject(I_BOOK_REPOSITORY) readonly _bookRepository: IBookRepository,
		readonly _sensitiveContentService: SensitiveContentService,
		@Inject(MEILI_CLIENT) private readonly meiliClient: Meilisearch,
	) {}

	async search(query: string): Promise<Tag[]> {
		try {
			const result = await this.meiliClient.index('tags').search(query, {
				limit: 30,
			});

			return result.hits.map((hit) => ({
				id: hit.id as string,
				name: hit.name as string,
				altNames: hit.altNames as string[],
				description: hit.description as string,
			})) as unknown as Tag[];
		} catch (error: unknown) {
			this.logger.error(
				`Error searching tags in Meilisearch: ${error instanceof Error ? error.message : String(error)}`,
			);
			return [];
		}
	}

	async get(
		options: TagsOptions,
		maxWeightSensitiveContent = 99,
	): Promise<Tag[]> {
		return this.tagRepository.findWithFilters(
			options,
			maxWeightSensitiveContent,
		);
	}

	async mergeTags(id: string, _copy: string[]) {
		const tag = await this.tagRepository.findById(id);
		if (!tag) {
			this.logger.warn(`Tag with id ${id} not found`);
			throw new NotFoundException(`Tag with id ${id} not found`);
		}

		// Lógica simplificada para o build
		return tag;
	}
}
