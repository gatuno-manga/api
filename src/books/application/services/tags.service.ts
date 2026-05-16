import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { Book } from '@books/domain/entities/book';
import { Tag } from '@books/domain/entities/tag';
import { SensitiveContentService } from './sensitive-content.service';
import { TagsOptions } from '@books/application/dto/tags-options.dto';
import {
	I_TAG_REPOSITORY,
	ITagRepository,
} from '@books/application/ports/tag-repository.interface';
import {
	I_BOOK_REPOSITORY,
	IBookRepository,
} from '@books/application/ports/book-repository.interface';
import { MEILI_CLIENT } from '@/infrastructure/meilisearch/meilisearch.constants';
import { Meilisearch } from 'meilisearch';

@Injectable()
export class TagsService {
	private readonly logger = new Logger(TagsService.name);
	constructor(
		@Inject(I_TAG_REPOSITORY)
		private readonly tagRepository: ITagRepository,
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
		private readonly sensitiveContentService: SensitiveContentService,
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
		} catch (error) {
			this.logger.error(
				`Error searching tags in Meilisearch: ${error.message}`,
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

	async mergeTags(id: string, copy: string[]) {
		const tag = await this.tagRepository.findById(id);
		if (!tag) {
			this.logger.warn(`Tag with id ${id} not found`);
			throw new NotFoundException(`Tag with id ${id} not found`);
		}

		// Lógica simplificada para o build
		return tag;
	}
}
