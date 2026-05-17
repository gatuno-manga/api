import { ITagRepository } from '@books/application/ports/tag-repository.interface';
import { Tag as DomainTag } from '@books/domain/entities/tag';
import { Book as InfrastructureBook } from '@books/infrastructure/database/entities/book.entity';
import { Tag as InfrastructureTag } from '@books/infrastructure/database/entities/tags.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';

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
	) {
		this.repository = repository;
		this.bookRepository = bookRepository;
	}

	async findById(id: string): Promise<DomainTag | null> {
		const tag = await this.repository.findOne({ where: { id } });
		if (!tag) return null;
		const domainTag = new DomainTag();
		Object.assign(domainTag, tag);
		return domainTag;
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
		const updateData = data as QueryDeepPartialEntity<InfrastructureTag>;
		await this.repository.update(id, updateData);
	}

	async delete(id: string): Promise<void> {
		await this.repository.delete(id);
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
		const authors = await this.repository.find({
			where: { name: In(names) },
		});
		return authors.map((t) => {
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
			return Object.assign(domainTag, {
				bookId: r.bt_booksId,
			}) as DomainTag & { bookId: string };
		});
	}
}
