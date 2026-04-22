import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, DeepPartial } from 'typeorm';
import { IPageRepository } from '../../../application/ports/page-repository.interface';
import { Page as DomainPage } from '../../../domain/entities/page';
import { Page as InfrastructurePage } from '../entities/page.entity';
import { PageCriteria } from '@books/domain/types/criteria.types';

@Injectable()
export class TypeOrmPageRepositoryAdapter implements IPageRepository {
	constructor(
		@InjectRepository(InfrastructurePage)
		private readonly repository: Repository<InfrastructurePage>,
	) {}

	async findById(id: number): Promise<DomainPage | null> {
		const page = await this.repository.findOne({
			where: { id } as unknown as FindOptionsWhere<InfrastructurePage>,
		});
		return page as unknown as DomainPage;
	}

	async save(page: DomainPage): Promise<DomainPage> {
		const saved = await this.repository.save(
			page as unknown as InfrastructurePage,
		);
		return saved as unknown as DomainPage;
	}

	async saveAll(pages: DomainPage[]): Promise<DomainPage[]> {
		const saved = await this.repository.save(
			pages as unknown as InfrastructurePage[],
		);
		return saved as unknown as DomainPage[];
	}

	async delete(criteria: PageCriteria): Promise<void> {
		await this.repository.delete(
			criteria as unknown as FindOptionsWhere<InfrastructurePage>,
		);
	}

	async softDelete(criteria: PageCriteria): Promise<void> {
		await this.repository.softDelete(
			criteria as unknown as FindOptionsWhere<InfrastructurePage>,
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
			} as unknown as FindOptionsWhere<InfrastructurePage>,
		});
		return pages as unknown as DomainPage[];
	}

	async count(criteria?: PageCriteria): Promise<number> {
		return this.repository.count({
			where: criteria as unknown as FindOptionsWhere<InfrastructurePage>,
		});
	}

	create(data: Partial<DomainPage>): DomainPage {
		const page = this.repository.create(
			data as unknown as DeepPartial<InfrastructurePage>,
		);
		return page as unknown as DomainPage;
	}
}
