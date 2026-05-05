import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, DeepPartial, In } from 'typeorm';
import { ICoverRepository } from '@books/application/ports/cover-repository.interface';
import { Cover as DomainCover } from '@books/domain/entities/cover';
import { Cover as InfrastructureCover } from '@books/infrastructure/database/entities/cover.entity';
import { ImageMetadata } from '@src/common/domain/value-objects/image-metadata.vo';

@Injectable()
export class TypeOrmCoverRepositoryAdapter implements ICoverRepository {
	constructor(
		@InjectRepository(InfrastructureCover)
		private readonly repository: Repository<InfrastructureCover>,
	) {}

	async findById(
		id: string,
		relations?: string[],
	): Promise<DomainCover | null> {
		const cover = await this.repository.findOne({
			where: { id } as unknown as FindOptionsWhere<InfrastructureCover>,
			relations,
		});
		return cover as unknown as DomainCover;
	}

	async save(cover: DomainCover): Promise<DomainCover> {
		const saved = await this.repository.save(
			cover as unknown as InfrastructureCover,
		);
		return saved as unknown as DomainCover;
	}

	async saveAll(covers: DomainCover[]): Promise<DomainCover[]> {
		const saved = await this.repository.save(
			covers as unknown as InfrastructureCover[],
		);
		return saved as unknown as DomainCover[];
	}

	async delete(id: string): Promise<void> {
		await this.repository.delete(id);
	}

	async softDelete(id: string): Promise<void> {
		await this.repository.softDelete(id);
	}

	async softRemove(cover: DomainCover): Promise<void> {
		await this.repository.softRemove(
			cover as unknown as InfrastructureCover,
		);
	}

	async findByBookId(bookId: string): Promise<DomainCover[]> {
		const covers = await this.repository.find({
			where: {
				book: { id: bookId },
			} as unknown as FindOptionsWhere<InfrastructureCover>,
		});
		return covers as unknown as DomainCover[];
	}

	async findByBookIds(bookIds: string[]): Promise<DomainCover[]> {
		const covers = await this.repository.find({
			where: {
				book: { id: In(bookIds) },
			} as unknown as FindOptionsWhere<InfrastructureCover>,
			relations: ['book'],
		});
		return covers as unknown as DomainCover[];
	}

	create(data: Partial<DomainCover>): DomainCover {
		const cover = this.repository.create(
			data as unknown as DeepPartial<InfrastructureCover>,
		);
		return cover as unknown as DomainCover;
	}

	async update(criteria: unknown, data: Partial<DomainCover>): Promise<void> {
		await this.repository.update(
			criteria as FindOptionsWhere<InfrastructureCover>,
			data as unknown as InfrastructureCover,
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
