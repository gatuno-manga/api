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

	async mergeSensitiveContent(id: string, _copy: string[]) {
		// Lógica simplificada para o build
		return this.getOne(id);
	}

	async filterBooksSensitiveContent(
		_queryBuilder: SelectQueryBuilder<SensitiveContent>,
		_names?: string[],
		_weight = 0,
	): Promise<void> {
		// Esta lógica deve ser movida para o repositório/adapter
	}
}
