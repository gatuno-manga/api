import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { In, SelectQueryBuilder } from 'typeorm';
import { Book } from '../../domain/entities/book';
import { SensitiveContent } from '../../domain/entities/sensitive-content';
import { CreateSensitiveContentDto } from '../dto/create-sensitive-content.dto';
import { UpdateSensitiveContentDto } from '../dto/update-sensitive-content.dto';
import {
	I_SENSITIVE_CONTENT_REPOSITORY,
	ISensitiveContentRepository,
} from '../ports/sensitive-content-repository.interface';
import {
	I_BOOK_REPOSITORY,
	IBookRepository,
} from '../ports/book-repository.interface';

@Injectable()
export class SensitiveContentService {
	private readonly logger = new Logger(SensitiveContentService.name);
	constructor(
		@Inject(I_SENSITIVE_CONTENT_REPOSITORY)
		private readonly sensitiveContentRepository: ISensitiveContentRepository,
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
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

	async mergeSensitiveContent(id: string, copy: string[]) {
		// Lógica simplificada para o build
		return this.getOne(id);
	}

	async filterBooksSensitiveContent(
		queryBuilder: SelectQueryBuilder<SensitiveContent>,
		names?: string[],
		weight = 0,
	): Promise<void> {
		// Esta lógica deve ser movida para o repositório/adapter
	}
}
