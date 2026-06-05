import { IBookRelationshipRepository } from '@books/application/ports/book-relationship-repository.interface';
import { BookRelationship as DomainBookRelationship } from '@books/domain/entities/book-relationship';
import { BookRelationshipCriteria } from '@books/domain/types/criteria.types';
import { BookRelationship as InfrastructureBookRelationship } from '@books/infrastructure/database/entities/book-relationship.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

@Injectable()
export class TypeOrmBookRelationshipRepositoryAdapter
	implements IBookRelationshipRepository
{
	constructor(
		@InjectRepository(InfrastructureBookRelationship)
		private readonly repository: Repository<InfrastructureBookRelationship>,
	) {}

	async findById(id: string): Promise<DomainBookRelationship | null> {
		const rel = await this.repository.findOne({
			where: {
				id,
			} as unknown as FindOptionsWhere<InfrastructureBookRelationship>,
			relations: { sourceBook: true, targetBook: true },
		});
		return rel as unknown as DomainBookRelationship;
	}

	async save(
		relationship: DomainBookRelationship,
	): Promise<DomainBookRelationship> {
		const entity = this.repository.create(
			relationship as unknown as InfrastructureBookRelationship,
		);
		const saved = await this.repository.save(entity);
		const result = new DomainBookRelationship();
		Object.assign(result, saved);
		return result;
	}

	async findOneBy(
		criteria: BookRelationshipCriteria,
	): Promise<DomainBookRelationship | null> {
		const rel = await this.repository.findOneBy(
			criteria as unknown as FindOptionsWhere<InfrastructureBookRelationship>,
		);
		return rel as unknown as DomainBookRelationship;
	}

	async softDelete(id: string): Promise<void> {
		await this.repository.softDelete(id);
	}

	async findRelationshipsByBookId(
		bookId: string,
	): Promise<DomainBookRelationship[]> {
		const relationships = await this.repository.find({
			where: [
				{
					sourceBookId: bookId,
				} as unknown as FindOptionsWhere<InfrastructureBookRelationship>,
				{
					targetBookId: bookId,
				} as unknown as FindOptionsWhere<InfrastructureBookRelationship>,
			],
			relations: {
				sourceBook: {
					tags: true,
					sensitiveContent: true,
					covers: true,
				},
				targetBook: {
					tags: true,
					sensitiveContent: true,
					covers: true,
				},
			},
		});

		return relationships as unknown as DomainBookRelationship[];
	}
}
