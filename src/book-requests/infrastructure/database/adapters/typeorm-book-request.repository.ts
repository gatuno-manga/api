import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookRequestRepository } from '@/book-requests/application/ports/book-request.repository';
import { BookRequest } from '@/book-requests/domain/entities/book-request';
import { BookRequestEntity } from '@/book-requests/infrastructure/database/entities/book-request.entity';
import {
	mapBookRequestToDomain,
	mapBookRequestToEntity,
} from './book-request.mapper';

@Injectable()
export class TypeOrmBookRequestRepository implements BookRequestRepository {
	constructor(
		@InjectRepository(BookRequestEntity)
		private readonly repository: Repository<BookRequestEntity>,
	) {}

	async save(bookRequest: BookRequest): Promise<void> {
		const entity = mapBookRequestToEntity(bookRequest);
		await this.repository.save(entity);
	}

	async findById(id: string): Promise<BookRequest | null> {
		const entity = await this.repository.findOne({ where: { id } });
		if (!entity) {
			return null;
		}
		return mapBookRequestToDomain(entity);
	}

	async findAll(): Promise<BookRequest[]> {
		const entities = await this.repository.find({
			relations: ['user', 'admin'],
			order: { createdAt: 'DESC' },
		});
		return entities.map((entity) => mapBookRequestToDomain(entity));
	}

	async findByUserId(userId: string): Promise<BookRequest[]> {
		const entities = await this.repository.find({
			where: { userId },
			order: { createdAt: 'DESC' },
		});
		return entities.map((entity) => mapBookRequestToDomain(entity));
	}
}
