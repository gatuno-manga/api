import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	In,
	LessThanOrEqual,
	MoreThanOrEqual,
	Repository,
	SelectQueryBuilder,
} from 'typeorm';
import { Book } from '../entities/book.entity';
import { SensitiveContent } from '../entities/sensitive-content.entity';
import { CreateSensitiveContentDto } from './dto/create-sensitive-content.dto';
import { UpdateSensitiveContentDto } from './dto/update-sensitive-content.dto';

@Injectable()
export class SensitiveContentService {
	private readonly logger = new Logger(SensitiveContentService.name);
	constructor(
		@InjectRepository(SensitiveContent)
		private readonly sensitiveContentRepository: Repository<SensitiveContent>,
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
	) {}

	async getAll(maxWeightSensitiveContent = 0): Promise<SensitiveContent[]> {
		return this.sensitiveContentRepository.find({
			select: ['id', 'name', 'altNames'],
			order: { weight: 'ASC' },
			where: { weight: LessThanOrEqual(maxWeightSensitiveContent) },
		});
	}

	async getOne(id: string): Promise<SensitiveContent> {
		const sensitiveContent = await this.sensitiveContentRepository.findOne({
			where: { id },
		});
		if (!sensitiveContent) {
			throw new NotFoundException(
				`Sensitive content with id ${id} not found`,
			);
		}
		return sensitiveContent;
	}

	async create(dto: CreateSensitiveContentDto): Promise<SensitiveContent> {
		const sensitiveContent = this.sensitiveContentRepository.create(dto);
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
		const sensitiveContent = await this.sensitiveContentRepository.findOne({
			where: { id },
		});
		if (!sensitiveContent) {
			this.logger.warn(`Sensitive content with id ${id} not found`);
			throw new NotFoundException(
				`Sensitive content with id ${id} not found`,
			);
		}
		const copyContents = await this.sensitiveContentRepository.find({
			where: { id: In(copy) },
		});
		if (copyContents.length === 0) {
			this.logger.warn(
				`No sensitive content found for names: ${copy.join(', ')}`,
			);
			throw new NotFoundException(
				`No sensitive content found for names: ${copy.join(', ')}`,
			);
		}
		const books = await this.bookRepository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.sensitiveContent', 'sensitiveContent')
			.where('sensitiveContent.id IN (:...copyIds)', { copyIds: copy })
			.getMany();

		for (const book of books) {
			book.sensitiveContent = book.sensitiveContent.filter(
				(sc) => !copy.includes(sc.id),
			);
			if (!book.sensitiveContent.some((sc) => sc.id === id)) {
				book.sensitiveContent.push(sensitiveContent);
			}
			await this.bookRepository.save(book);
		}
		sensitiveContent.altNames = Array.from(
			new Set([
				...(sensitiveContent.altNames || []),
				...copyContents.flatMap((sc) => sc.altNames || []),
				...copyContents.map((sc) => sc.name),
			]),
		);
		await this.sensitiveContentRepository.save(sensitiveContent);
		await this.sensitiveContentRepository.remove(copyContents);
		return sensitiveContent;
	}

	async filterBooksSensitiveContent(
		queryBuilder: SelectQueryBuilder<Book>,
		names?: string[],
		weight = 0,
	): Promise<void> {
		let filterSafe = false;
		let maxWeight: number | undefined = undefined;
		let sensitiveContentNames: string[] = [];
		if (names) {
			filterSafe = names.includes('safe');
			sensitiveContentNames = names.filter((name) => name !== 'safe');
		}
		if (sensitiveContentNames.length === 0) {
			queryBuilder.andWhere('sensitiveContent.name IS NULL');
		} else if (sensitiveContentNames.length > 0) {
			const sensitiveContents =
				await this.sensitiveContentRepository.find({
					where: [
						{
							name: In(sensitiveContentNames),
							weight: LessThanOrEqual(weight),
						},
					],
				});
			if (sensitiveContents.length > 0) {
				maxWeight = Math.max(
					...sensitiveContents.map((sc) => sc.weight),
				);
				if (filterSafe) {
					queryBuilder.andWhere(
						'(sensitiveContent.name IN (:...sensitiveContents) OR sensitiveContent.name IS NULL)',
						{ sensitiveContents: sensitiveContentNames },
					);
				} else {
					queryBuilder.andWhere(
						'sensitiveContent.name IN (:...sensitiveContents)',
						{ sensitiveContents: sensitiveContentNames },
					);
				}
				queryBuilder.andWhere(
					'((SELECT MAX(sc.weight) FROM books_sensitive_content_sensitive_content ssc INNER JOIN sensitive_content sc ON sc.id = ssc.sensitiveContentId WHERE ssc.booksId = book.id) <= :maxWeight OR sensitiveContent.name IS NULL)',
					{ maxWeight },
				);
			} else {
				queryBuilder.andWhere('sensitiveContent.name IS NULL');
			}
		}
	}
}
