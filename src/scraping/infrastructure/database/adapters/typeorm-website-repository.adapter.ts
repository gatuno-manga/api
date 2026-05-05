import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { IWebsiteRepository } from '@scraping/application/ports/website-repository.interface';
import { Website as DomainWebsite } from '@scraping/domain/entities/website';
import { Website as InfrastructureWebsite } from '@scraping/infrastructure/database/entities/website.entity';

@Injectable()
export class TypeOrmWebsiteRepositoryAdapter implements IWebsiteRepository {
	constructor(
		@InjectRepository(InfrastructureWebsite)
		private readonly repository: Repository<InfrastructureWebsite>,
	) {}

	async findById(id: string): Promise<DomainWebsite | null> {
		const entity = await this.repository.findOneBy({
			id,
		} as FindOptionsWhere<InfrastructureWebsite>);
		return entity ? this.mapToDomain(entity) : null;
	}

	async findByUrl(url: string): Promise<DomainWebsite | null> {
		const entity = await this.repository.findOneBy({
			url,
		} as FindOptionsWhere<InfrastructureWebsite>);
		return entity ? this.mapToDomain(entity) : null;
	}

	async findAll(): Promise<DomainWebsite[]> {
		const entities = await this.repository.find();
		return entities.map((entity) => this.mapToDomain(entity));
	}

	async save(website: DomainWebsite): Promise<DomainWebsite> {
		const entity = this.mapToInfrastructure(website);
		const savedEntity = await this.repository.save(entity);
		return this.mapToDomain(savedEntity);
	}

	async delete(id: string): Promise<void> {
		await this.repository.delete(id);
	}

	private mapToDomain(entity: InfrastructureWebsite): DomainWebsite {
		const domain = new DomainWebsite();
		Object.assign(domain, entity);
		return domain;
	}

	private mapToInfrastructure(domain: DomainWebsite): InfrastructureWebsite {
		const entity = new InfrastructureWebsite();
		Object.assign(entity, domain);
		return entity;
	}
}
