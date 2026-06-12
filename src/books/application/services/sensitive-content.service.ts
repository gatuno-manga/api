import { CreateSensitiveContentDto } from '@books/application/dto/create-sensitive-content.dto';
import { UpdateSensitiveContentDto } from '@books/application/dto/update-sensitive-content.dto';
import {
	IBookRepository,
	I_BOOK_REPOSITORY,
} from '@books/application/ports/book-repository.interface';
import {
	ISensitiveContentRepository,
	I_SENSITIVE_CONTENT_REPOSITORY,
} from '@books/application/ports/sensitive-content-repository.interface';
import { SensitiveContent } from '@books/domain/entities/sensitive-content';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';

@Injectable()
export class SensitiveContentService {
	constructor(
		@Inject(I_SENSITIVE_CONTENT_REPOSITORY)
		private readonly sensitiveContentRepository: ISensitiveContentRepository,
		@Inject(I_BOOK_REPOSITORY) readonly _bookRepository: IBookRepository,
	) {}

	async getAll(maxWeightSensitiveContent = 0): Promise<SensitiveContent[]> {
		return this.sensitiveContentRepository.findAll(
			maxWeightSensitiveContent,
		);
	}

	async getOne(id: string): Promise<SensitiveContent> {
		const sensitiveContent =
			await this.sensitiveContentRepository.findById(id);
		if (!sensitiveContent) {
			throw new NotFoundException(
				`Sensitive content with id ${id} not found`,
			);
		}
		return sensitiveContent;
	}

	async create(dto: CreateSensitiveContentDto): Promise<SensitiveContent> {
		const existing =
			await this.sensitiveContentRepository.findByNameOrAlias(dto.name);
		if (existing) {
			return existing;
		}

		const sensitiveContent = new SensitiveContent();
		Object.assign(sensitiveContent, dto);
		return this.sensitiveContentRepository.save(sensitiveContent);
	}

	async update(
		id: string,
		dto: UpdateSensitiveContentDto,
	): Promise<SensitiveContent> {
		const sensitiveContent = await this.getOne(id);
		Object.assign(sensitiveContent, dto);
		return this.sensitiveContentRepository.save(sensitiveContent);
	}

	async remove(id: string): Promise<void> {
		const sensitiveContent = await this.getOne(id);
		await this.sensitiveContentRepository.remove(sensitiveContent);
	}

	async mergeSensitiveContent(id: string, copyIds: string[]) {
		const target = await this.getOne(id);

		const validCopyIds = copyIds.filter((copyId) => copyId !== id);
		if (!validCopyIds.length) {
			return target;
		}

		const itemsToMerge =
			await this.sensitiveContentRepository.findByIds(validCopyIds);
		if (!itemsToMerge.length) {
			return target;
		}

		const aliasesSet = new Set<string>(target.aliases || []);

		for (const item of itemsToMerge) {
			aliasesSet.add(item.name);
			if (item.aliases && item.aliases.length > 0) {
				for (const alias of item.aliases) {
					aliasesSet.add(alias);
				}
			}
		}

		aliasesSet.delete(target.name);

		target.aliases = Array.from(aliasesSet);
		await this.sensitiveContentRepository.save(target);

		const actualMergeIds = itemsToMerge.map((item) => item.id);
		await this.sensitiveContentRepository.replaceReferences(
			actualMergeIds,
			target.id,
		);
		await this.sensitiveContentRepository.deleteByIds(actualMergeIds);

		return target;
	}

	async filterBooksSensitiveContent(
		_queryBuilder: SelectQueryBuilder<SensitiveContent>,
		_names?: string[],
		_weight = 0,
	): Promise<void> {
		// Esta lógica deve ser movida para o repositório/adapter
	}
}
