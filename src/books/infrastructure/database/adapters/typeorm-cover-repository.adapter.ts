import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, DeepPartial } from 'typeorm';
import { ICoverRepository } from '@books/application/ports/cover-repository.interface';
import { Cover as DomainCover } from '@books/domain/entities/cover';
import { Cover as InfrastructureCover } from '@books/infrastructure/database/entities/cover.entity';

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

	create(data: Partial<DomainCover>): DomainCover {
		const cover = this.repository.create(
			data as unknown as DeepPartial<InfrastructureCover>,
		);
		return cover as unknown as DomainCover;
	}
}
