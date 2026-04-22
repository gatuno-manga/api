import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { IBookRelationshipRepository } from '@books/application/ports/book-relationship-repository.interface';
import { BookRelationship as DomainBookRelationship } from '@books/domain/entities/book-relationship';
import { BookRelationship as InfrastructureBookRelationship } from '@books/infrastructure/database/entities/book-relationship.entity';
import { BookRelationshipCriteria } from '@books/domain/types/criteria.types';

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
		const saved = await this.repository.save(
			relationship as unknown as InfrastructureBookRelationship,
		);
		return saved as unknown as DomainBookRelationship;
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
				},
				targetBook: {
					tags: true,
					sensitiveContent: true,
				},
			},
		});

		return relationships as unknown as DomainBookRelationship[];
	}
}
