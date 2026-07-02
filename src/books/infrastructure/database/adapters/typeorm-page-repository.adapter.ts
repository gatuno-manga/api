import { IPageRepository } from '@books/application/ports/page-repository.interface';
import { Page as DomainPage } from '@books/domain/entities/page';
import { PageCriteria } from '@books/domain/types/criteria.types';
import { Page as InfrastructurePage } from '@books/infrastructure/database/entities/page.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ImageMetadata } from '@src/common/domain/value-objects/image-metadata.vo';
import { DeepPartial, FindOptionsWhere, In, Repository } from 'typeorm';

@Injectable()
export class TypeOrmPageRepositoryAdapter implements IPageRepository {
	constructor(
		@InjectRepository(InfrastructurePage)
		private readonly repository: Repository<InfrastructurePage>,
	) {}

	async findById(id: number): Promise<DomainPage | null> {
		const page = await this.repository.findOne({
			where: { id } as FindOptionsWhere<InfrastructurePage>,
		});
		return page as DomainPage | null;
	}

	async save(page: DomainPage): Promise<DomainPage> {
		const saved = await this.repository.save(
			page as unknown as InfrastructurePage,
		);
		return saved as DomainPage;
	}

	async saveAll(pages: DomainPage[]): Promise<DomainPage[]> {
		const saved = await this.repository.save(
			pages as unknown as InfrastructurePage[],
		);
		return saved as DomainPage[];
	}

	async delete(criteria: PageCriteria): Promise<void> {
		await this.repository.delete(
			criteria as FindOptionsWhere<InfrastructurePage>,
		);
	}

	async softDelete(criteria: PageCriteria): Promise<void> {
		await this.repository.softDelete(
			criteria as FindOptionsWhere<InfrastructurePage>,
		);
	}

	async softRemove(pages: DomainPage[]): Promise<void> {
		await this.repository.softRemove(
			pages as unknown as InfrastructurePage[],
		);
	}

	async findByChapterId(chapterId: string): Promise<DomainPage[]> {
		const pages = await this.repository.find({
			where: {
				chapter: { id: chapterId },
			} as FindOptionsWhere<InfrastructurePage>,
		});
		return pages as DomainPage[];
	}

	async count(criteria?: PageCriteria): Promise<number> {
		return this.repository.count({
			where: criteria as FindOptionsWhere<InfrastructurePage>,
		});
	}

	create(data: Partial<DomainPage>): DomainPage {
		const page = this.repository.create(
			data as DeepPartial<InfrastructurePage>,
		);
		return page as DomainPage;
	}

	async update(
		criteria: PageCriteria,
		data: Partial<DomainPage>,
	): Promise<void> {
		await this.repository.update(
			criteria as FindOptionsWhere<InfrastructurePage>,
			data as Parameters<Repository<InfrastructurePage>['update']>[1],
		);
	}

	async updateBatch(
		updates: { oldPath: string; newPath: string; metadata?: unknown }[],
	): Promise<void> {
		const oldPaths = updates.map((u) => u.oldPath);
		const pages = await this.repository.find({
			where: {
				path: In(oldPaths),
			} as FindOptionsWhere<InfrastructurePage>,
		});

		for (const page of pages) {
			const update = updates.find((u) => u.oldPath === page.path);
			if (update) {
				page.path = update.newPath;
				if (update.metadata) {
					page.metadata = update.metadata as ImageMetadata;
				}
			}
		}

		await this.repository.save(pages);
	}
}
