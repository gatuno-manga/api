import { TagsOptions } from '@books/application/dto/tags-options.dto';
import { ITagRepository } from '@books/application/ports/tag-repository.interface';
import { Tag as DomainTag } from '@books/domain/entities/tag';
import { TagCriteria } from '@books/domain/types/criteria.types';
import { Book as InfrastructureBook } from '@books/infrastructure/database/entities/book.entity';
import { Tag as InfrastructureTag } from '@books/infrastructure/database/entities/tags.entity';
import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, In, Repository } from 'typeorm';

interface RawTagResult {
	tag_id: string;
	tag_name: string;
	bt_booksId: string;
}

@Injectable()
export class TypeOrmTagRepositoryAdapter implements ITagRepository {
	private readonly repository: Repository<InfrastructureTag>;
	private readonly bookRepository: Repository<InfrastructureBook>;

	constructor(
		@InjectRepository(InfrastructureTag)
		repository: Repository<InfrastructureTag>,
		@InjectRepository(InfrastructureBook)
		bookRepository: Repository<InfrastructureBook>,
		@Optional()
		entityManager?: EntityManager,
	) {
		this.repository = entityManager?.getRepository
			? entityManager.getRepository(InfrastructureTag)
			: repository;
		this.bookRepository = entityManager?.getRepository
			? entityManager.getRepository(InfrastructureBook)
			: bookRepository;
	}

	async findById(
		id: string,
		relations?: string[],
	): Promise<DomainTag | null> {
		const tag = await this.repository.findOne({ where: { id }, relations });
		if (!tag) return null;
		const domainTag = new DomainTag();
		Object.assign(domainTag, tag);
		return domainTag;
	}

	async findAll(): Promise<DomainTag[]> {
		const tags = await this.repository.find({ order: { name: 'ASC' } });
		return tags.map((t) => {
			const result = new DomainTag();
			Object.assign(result, t);
			return result;
		});
	}

	async save(tag: DomainTag): Promise<DomainTag> {
		const entity = this.repository.create();
		Object.assign(entity, tag);
		const saved = await this.repository.save(entity);
		const result = new DomainTag();
		Object.assign(result, saved);
		return result;
	}

	async saveAll(tags: DomainTag[]): Promise<DomainTag[]> {
		const entities = tags.map((t) => {
			const entity = this.repository.create();
			Object.assign(entity, t);
			return entity;
		});
		const saved = await this.repository.save(entities);
		return saved.map((s) => {
			const result = new DomainTag();
			Object.assign(result, s);
			return result;
		});
	}

	async update(id: string, data: Partial<DomainTag>): Promise<void> {
		const updateData: Parameters<
			Repository<InfrastructureTag>['update']
		>[1] = {};
		if (data.name !== undefined) updateData.name = data.name;

		await this.repository.update(id, updateData);
	}

	async delete(id: string): Promise<void> {
		await this.repository.delete(id);
	}

	async deleteByIds(ids: string[]): Promise<void> {
		await this.repository.delete(ids);
	}

	async remove(tags: DomainTag[]): Promise<void> {
		const entities = tags.map((t) => {
			const entity = this.repository.create();
			Object.assign(entity, t);
			return entity;
		});
		await this.repository.remove(entities);
	}

	async findByIds(ids: string[]): Promise<DomainTag[]> {
		const tags = await this.repository.find({
			where: { id: In(ids) },
			order: { name: 'ASC' },
		});
		return tags.map((t) => {
			const result = new DomainTag();
			Object.assign(result, t);
			return result;
		});
	}

	async findOne(
		criteria: FindOptionsWhere<InfrastructureTag>,
	): Promise<DomainTag | null> {
		const tag = await this.repository.findOne({ where: criteria });
		if (!tag) return null;
		const result = new DomainTag();
		Object.assign(result, tag);
		return result;
	}

	async find(
		criteria: FindOptionsWhere<InfrastructureTag>,
	): Promise<DomainTag[]> {
		const tags = await this.repository.find({ where: criteria });
		return tags.map((t) => {
			const result = new DomainTag();
			Object.assign(result, t);
			return result;
		});
	}

	async findByName(name: string): Promise<DomainTag | null> {
		const tag = await this.repository.findOne({ where: { name } });
		if (!tag) return null;
		const result = new DomainTag();
		Object.assign(result, tag);
		return result;
	}

	async findOrCreateByName(name: string): Promise<DomainTag> {
		let tag = await this.repository.findOne({ where: { name } });
		if (!tag) {
			tag = this.repository.create({ name });
			tag = await this.repository.save(tag);
		}
		const result = new DomainTag();
		Object.assign(result, tag);
		return result;
	}

	async exists(id: string): Promise<boolean> {
		const count = await this.repository.count({ where: { id } });
		return count > 0;
	}

	async findByBookId(bookId: string): Promise<DomainTag[]> {
		const book = await this.bookRepository.findOne({
			where: { id: bookId },
			relations: ['tags'],
		});
		return (book?.tags || []).map((t) => {
			const result = new DomainTag();
			Object.assign(result, t);
			return result;
		});
	}

	async findByNames(names: string[]): Promise<DomainTag[]> {
		if (names.length === 0) return [];
		const tags = await this.repository.find({
			where: { name: In(names) },
		});
		return tags.map((t) => {
			const result = new DomainTag();
			Object.assign(result, t);
			return result;
		});
	}

	async searchByNames(names: string[]): Promise<DomainTag[]> {
		const tagIds = await Promise.all(
			names.map(async (name) => {
				const tag = await this.findOrCreateByName(name);
				return tag.id;
			}),
		);

		if (tagIds.length === 0) return [];

		const tags = await this.repository.find({
			where: { id: In(tagIds) },
			order: { name: 'ASC' },
		});
		return tags.map((t) => {
			const result = new DomainTag();
			Object.assign(result, t);
			return result;
		});
	}

	async findWithFilters(
		options: TagsOptions,
		_maxWeight?: number,
	): Promise<DomainTag[]> {
		const queryBuilder = this.repository.createQueryBuilder('tag');

		const d = options as Record<string, unknown>;
		if (d.search) {
			queryBuilder.where('tag.name LIKE :search', {
				search: `%${d.search as string}%`,
			});
		}

		if (d.limit) {
			queryBuilder.take(d.limit as number);
		}

		if (d.offset) {
			queryBuilder.skip(d.offset as number);
		}

		queryBuilder.orderBy('tag.name', 'ASC');

		const tags = await queryBuilder.getMany();
		return tags.map((t) => {
			const result = new DomainTag();
			Object.assign(result, t);
			return result;
		});
	}

	async findByBookIds(
		bookIds: string[],
	): Promise<(DomainTag & { bookId: string })[]> {
		const results = await this.repository
			.createQueryBuilder('tag')
			.innerJoin('books_tags_tags', 'bt', 'tag.id = bt.tagsId')
			.select(['tag.id', 'tag.name', 'bt.booksId'])
			.where('bt.booksId IN (:...bookIds)', { bookIds })
			.getRawMany<RawTagResult>();

		return results.map((r) => {
			const domainTag = new DomainTag();
			domainTag.id = r.tag_id;
			domainTag.name = r.tag_name;
			const extendedTag = domainTag as unknown as DomainTag & {
				bookId: string;
			};
			extendedTag.bookId = r.bt_booksId;
			return extendedTag;
		});
	}

	async count(criteria?: TagCriteria): Promise<number> {
		return this.repository.count({
			where: criteria as unknown as FindOptionsWhere<InfrastructureTag>,
		});
	}
}
