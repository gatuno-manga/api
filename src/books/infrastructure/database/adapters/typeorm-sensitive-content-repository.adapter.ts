import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	In,
	LessThanOrEqual,
	Repository,
	FindOptionsWhere,
	EntityManager,
} from 'typeorm';
import { ISensitiveContentRepository } from '@books/application/ports/sensitive-content-repository.interface';
import { SensitiveContent as DomainSensitiveContent } from '@books/domain/entities/sensitive-content';
import { SensitiveContent as InfrastructureSensitiveContent } from '@books/infrastructure/database/entities/sensitive-content.entity';
import { SensitiveContentCriteria } from '@books/domain/types/criteria.types';

@Injectable()
export class TypeOrmSensitiveContentRepositoryAdapter
	implements ISensitiveContentRepository
{
	private readonly repository: Repository<InfrastructureSensitiveContent>;

	constructor(
		@InjectRepository(InfrastructureSensitiveContent)
		repository: Repository<InfrastructureSensitiveContent>,
		entityManager?: EntityManager,
	) {
		this.repository = entityManager
			? entityManager.getRepository(InfrastructureSensitiveContent)
			: repository;
	}

	async findById(
		id: string,
		relations?: string[],
	): Promise<DomainSensitiveContent | null> {
		const content = await this.repository.findOne({
			where: {
				id,
			} as unknown as FindOptionsWhere<InfrastructureSensitiveContent>,
			relations,
		});
		return content as unknown as DomainSensitiveContent;
	}

	async findAll(maxWeight = 0): Promise<DomainSensitiveContent[]> {
		const contents = await this.repository.find({
			where: { weight: LessThanOrEqual(maxWeight) },
			order: { weight: 'ASC' },
		});
		return contents as unknown as DomainSensitiveContent[];
	}

	async save(
		content: DomainSensitiveContent,
	): Promise<DomainSensitiveContent> {
		const saved = await this.repository.save(
			content as unknown as InfrastructureSensitiveContent,
		);
		return saved as unknown as DomainSensitiveContent;
	}

	async remove(content: DomainSensitiveContent): Promise<void> {
		await this.repository.remove(
			content as unknown as InfrastructureSensitiveContent,
		);
	}

	async deleteByIds(ids: string[]): Promise<void> {
		await this.repository.delete(ids);
	}

	async findByName(name: string): Promise<DomainSensitiveContent | null> {
		const content = await this.repository.findOne({
			where: {
				name,
			} as unknown as FindOptionsWhere<InfrastructureSensitiveContent>,
		});
		return content as unknown as DomainSensitiveContent;
	}

	async findByNames(
		names: string[],
		weight: number,
	): Promise<DomainSensitiveContent[]> {
		const contents = await this.repository.find({
			where: {
				name: In(names),
				weight: LessThanOrEqual(weight),
			},
		});
		return contents as unknown as DomainSensitiveContent[];
	}

	async count(criteria?: SensitiveContentCriteria): Promise<number> {
		return this.repository.count({
			where: criteria as unknown as FindOptionsWhere<InfrastructureSensitiveContent>,
		});
	}
}
