import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, FindOptionsWhere } from 'typeorm';
import { ITagRepository } from '../../../application/ports/tag-repository.interface';
import { Tag as DomainTag } from '../../../domain/entities/tag';
import { Tag as InfrastructureTag } from '../entities/tags.entity';
import { TagsOptions } from '../../../application/dto/tags-options.dto';
import { Book as InfrastructureBook } from '../entities/book.entity';
import { TagCriteria } from '@books/domain/types/criteria.types';

@Injectable()
export class TypeOrmTagRepositoryAdapter implements ITagRepository {
	constructor(
		@InjectRepository(InfrastructureTag)
		private readonly repository: Repository<InfrastructureTag>,
		@InjectRepository(InfrastructureBook)
		private readonly bookRepository: Repository<InfrastructureBook>,
	) {}

	async findById(
		id: string,
		relations?: string[],
	): Promise<DomainTag | null> {
		const tag = await this.repository.findOne({
			where: { id } as unknown as FindOptionsWhere<InfrastructureTag>,
			relations,
		});
		return tag as unknown as DomainTag;
	}

	async findAll(): Promise<DomainTag[]> {
		const tags = await this.repository.find();
		return tags as unknown as DomainTag[];
	}

	async save(tag: DomainTag): Promise<DomainTag> {
		const saved = await this.repository.save(
			tag as unknown as InfrastructureTag,
		);
		return saved as unknown as DomainTag;
	}

	async remove(tags: DomainTag[]): Promise<void> {
		await this.repository.remove(tags as unknown as InfrastructureTag[]);
	}

	async deleteByIds(ids: string[]): Promise<void> {
		await this.repository.delete(ids);
	}

	async findByName(name: string): Promise<DomainTag | null> {
		const tag = await this.repository.findOne({
			where: { name } as unknown as FindOptionsWhere<InfrastructureTag>,
		});
		return tag as unknown as DomainTag;
	}

	async exists(id: string): Promise<boolean> {
		return this.repository.exists({
			where: { id } as unknown as FindOptionsWhere<InfrastructureTag>,
		});
	}

	async count(criteria?: TagCriteria): Promise<number> {
		return this.repository.count({
			where: criteria as unknown as FindOptionsWhere<InfrastructureTag>,
		});
	}

	async findWithFilters(
		options: TagsOptions,
		maxWeight = 99,
	): Promise<DomainTag[]> {
		const queryBuilder = this.bookRepository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.tags', 'tag')
			.leftJoin('book.sensitiveContent', 'sensitiveContent');

		if (options.sensitiveContent && options.sensitiveContent.length > 0) {
			queryBuilder.andWhere('sensitiveContent.name IN (:...names)', {
				names: options.sensitiveContent,
			});
		}
		queryBuilder.andWhere(
			'sensitiveContent.weight <= :maxWeight OR sensitiveContent.id IS NULL',
			{ maxWeight },
		);

		const books = await queryBuilder.getMany();
		const tagIds = Array.from(
			new Set(books.flatMap((book) => book.tags.map((tag) => tag.id))),
		);

		if (tagIds.length === 0) return [];

		const tags = await this.repository.find({
			where: { id: In(tagIds) },
			order: { name: 'ASC' },
		});
		return tags as unknown as DomainTag[];
	}
}
