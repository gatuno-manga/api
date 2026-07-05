import { ISensitiveContentRepository } from '@books/application/ports/sensitive-content-repository.interface';
import { SensitiveContent as DomainSensitiveContent } from '@books/domain/entities/sensitive-content';
import { SensitiveContentCriteria } from '@books/domain/types/criteria.types';
import { SensitiveContent as InfrastructureSensitiveContent } from '@books/infrastructure/database/entities/sensitive-content.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	EntityManager,
	FindOptionsWhere,
	In,
	LessThanOrEqual,
	Repository,
} from 'typeorm';

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
			where: { id } as FindOptionsWhere<InfrastructureSensitiveContent>,
			relations,
		});
		return content as DomainSensitiveContent | null;
	}

	async findAll(maxWeight = 0): Promise<DomainSensitiveContent[]> {
		const contents = await this.repository.find({
			where: { weight: LessThanOrEqual(maxWeight) },
			order: { weight: 'ASC' },
		});
		return contents as DomainSensitiveContent[];
	}

	async save(
		content: DomainSensitiveContent,
	): Promise<DomainSensitiveContent> {
		const saved = await this.repository.save(
			content as unknown as InfrastructureSensitiveContent,
		);
		return saved as DomainSensitiveContent;
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
			where: { name } as FindOptionsWhere<InfrastructureSensitiveContent>,
		});
		return content as DomainSensitiveContent | null;
	}

	async findByNameOrAlias(
		name: string,
	): Promise<DomainSensitiveContent | null> {
		const content = await this.repository
			.createQueryBuilder('sc')
			.where('sc.name = :name', { name })
			.orWhere('JSON_CONTAINS(sc.aliases, :jsonName)', {
				jsonName: JSON.stringify(name),
			})
			.getOne();
		return content as DomainSensitiveContent | null;
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
		return contents as DomainSensitiveContent[];
	}

	async findByIds(ids: string[]): Promise<DomainSensitiveContent[]> {
		if (!ids.length) return [];
		const contents = await this.repository.find({
			where: { id: In(ids) },
		});
		return contents as DomainSensitiveContent[];
	}

	async replaceReferences(oldIds: string[], newId: string): Promise<void> {
		if (!oldIds.length) return;

		const placeholders = oldIds.map(() => '?').join(', ');

		// Insert new relationships for books that had any of the old ones (IGNORE prevents duplicate entry error)
		await this.repository.query(
			`INSERT IGNORE INTO books_sensitive_content_sensitive_content (booksId, sensitiveContentId)
			SELECT booksId, ? FROM books_sensitive_content_sensitive_content WHERE sensitiveContentId IN (${placeholders})`,
			[newId, ...oldIds],
		);

		// Remove the old relationships
		await this.repository.query(
			`DELETE FROM books_sensitive_content_sensitive_content WHERE sensitiveContentId IN (${placeholders})`,
			oldIds,
		);
	}

	async count(criteria?: SensitiveContentCriteria): Promise<number> {
		return this.repository.count({
			where: criteria as FindOptionsWhere<InfrastructureSensitiveContent>,
		});
	}
}
