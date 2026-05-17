import { ICoverRepository } from '@books/application/ports/cover-repository.interface';
import { Cover as DomainCover } from '@books/domain/entities/cover';
import { Cover as InfrastructureCover } from '@books/infrastructure/database/entities/cover.entity';
import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ImageMetadata } from '@src/common/domain/value-objects/image-metadata.vo';
import {
	EntityManager,
	FindOptionsOrder,
	FindOptionsWhere,
	In,
	Repository,
} from 'typeorm';

@Injectable()
export class TypeOrmCoverRepositoryAdapter implements ICoverRepository {
	private readonly repository: Repository<InfrastructureCover>;

	constructor(
		@InjectRepository(InfrastructureCover)
		repository: Repository<InfrastructureCover>,
		@Optional()
		entityManager?: EntityManager,
	) {
		this.repository = entityManager
			? entityManager.getRepository(InfrastructureCover)
			: repository;
	}

	async findById(
		id: string,
		relations?: string[],
	): Promise<DomainCover | null> {
		const cover = await this.repository.findOne({
			where: { id } as FindOptionsWhere<InfrastructureCover>,
			relations,
		});
		if (!cover) return null;
		const domainCover = new DomainCover();
		Object.assign(domainCover, cover);
		return domainCover;
	}

	async save(cover: DomainCover): Promise<DomainCover> {
		const entity = this.repository.create();
		Object.assign(entity, cover);
		const saved = await this.repository.save(entity);
		const result = new DomainCover();
		Object.assign(result, saved);
		return result;
	}

	async saveAll(covers: DomainCover[]): Promise<DomainCover[]> {
		const entities = covers.map((c) => {
			const entity = this.repository.create();
			Object.assign(entity, c);
			return entity;
		});
		const saved = await this.repository.save(entities);
		return saved.map((s) => {
			const result = new DomainCover();
			Object.assign(result, s);
			return result;
		});
	}

	async delete(id: string): Promise<void> {
		await this.repository.delete(id);
	}

	async softDelete(id: string): Promise<void> {
		await this.repository.softDelete(id);
	}

	async softRemove(cover: DomainCover): Promise<void> {
		const entity = this.repository.create();
		Object.assign(entity, cover);
		await this.repository.softRemove(entity);
	}

	async find(criteria: Partial<DomainCover>): Promise<DomainCover[]> {
		const covers = await this.repository.find({
			where: criteria as FindOptionsWhere<InfrastructureCover>,
		});
		return covers.map((c) => {
			const result = new DomainCover();
			Object.assign(result, c);
			return result;
		});
	}

	async findByBookId(
		bookId: string,
		comment?: string,
	): Promise<DomainCover[]> {
		const covers = await this.repository.find({
			where: {
				book: { id: bookId },
			} as FindOptionsWhere<InfrastructureCover>,
			order: {
				index: 'ASC',
			} as FindOptionsOrder<InfrastructureCover>,
			comment,
		});
		return covers.map((c) => {
			const result = new DomainCover();
			Object.assign(result, c);
			return result;
		});
	}

	async findByBookIds(bookIds: string[]): Promise<DomainCover[]> {
		const covers = await this.repository.find({
			where: {
				book: { id: In(bookIds) },
			} as FindOptionsWhere<InfrastructureCover>,
			relations: ['book'],
			order: {
				index: 'ASC',
			} as FindOptionsOrder<InfrastructureCover>,
		});
		return covers.map((c) => {
			const result = new DomainCover();
			Object.assign(result, c);
			return result;
		});
	}

	create(data: Partial<DomainCover>): DomainCover {
		const entity = this.repository.create();
		Object.assign(entity, data);
		const result = new DomainCover();
		Object.assign(result, entity);
		return result;
	}

	async update(
		criteria: Partial<DomainCover>,
		data: Partial<DomainCover>,
	): Promise<void> {
		await this.repository.update(
			criteria as FindOptionsWhere<InfrastructureCover>,
			data as Parameters<Repository<InfrastructureCover>['update']>[1],
		);
	}

	async updateBatch(
		updates: { oldPath: string; newPath: string; metadata?: unknown }[],
	): Promise<void> {
		const oldPaths = updates.map((u) => u.oldPath);
		const covers = await this.repository.find({
			where: {
				url: In(oldPaths),
			} as unknown as FindOptionsWhere<InfrastructureCover>,
		});

		for (const cover of covers) {
			const update = updates.find((u) => u.oldPath === cover.url);
			if (update) {
				cover.url = update.newPath;
				if (update.metadata) {
					cover.metadata = update.metadata as ImageMetadata;
				}
			}
		}

		await this.repository.save(covers);
	}
}
