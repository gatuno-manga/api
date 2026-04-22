import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { Book } from '../../domain/entities/book';
import { Tag } from '../../domain/entities/tag';
import { SensitiveContentService } from './sensitive-content.service';
import { TagsOptions } from '../dto/tags-options.dto';
import {
	I_TAG_REPOSITORY,
	ITagRepository,
} from '../ports/tag-repository.interface';
import {
	I_BOOK_REPOSITORY,
	IBookRepository,
} from '../ports/book-repository.interface';

@Injectable()
export class TagsService {
	private readonly logger = new Logger(TagsService.name);
	constructor(
		@Inject(I_TAG_REPOSITORY)
		private readonly tagRepository: ITagRepository,
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
		private readonly sensitiveContentService: SensitiveContentService,
	) {}

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
