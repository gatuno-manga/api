import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ISavedPagesRepository } from '@users/application/ports/saved-pages-repository.interface';
import { SavedPage as DomainSavedPage } from '@users/domain/entities/saved-page';
import { SavedPage as OrmSavedPage } from '@users/infrastructure/database/entities/saved-page.entity';
import { SavedPageMapper } from '@users/infrastructure/mappers/saved-page.mapper';
import { Page } from 'src/books/infrastructure/database/entities/page.entity';
import { FindOptionsWhere, MoreThanOrEqual, Repository } from 'typeorm';

@Injectable()
export class TypeOrmSavedPagesRepository implements ISavedPagesRepository {
	constructor(
		@InjectRepository(OrmSavedPage)
		private readonly repository: Repository<OrmSavedPage>,
		@InjectRepository(Page)
		private readonly pageRepository: Repository<Page>,
	) {}

	async save(savedPage: DomainSavedPage): Promise<DomainSavedPage> {
		const entity = SavedPageMapper.toOrm(savedPage);
		const savedEntity = await this.repository.save(entity);
		// To ensure we have relations loaded correctly if needed, we might fetch it or just return
		// We'll return the mapped domain entity.
		return SavedPageMapper.toDomain(savedEntity);
	}

	async findOneByPageAndUser(
		pageId: number,
		userId: UserId,
		withDeleted = false,
	): Promise<DomainSavedPage | null> {
		const entity = await this.repository.findOne({
			where: { user: { id: userId.toString() }, page: { id: pageId } },
			withDeleted,
		});
		return entity ? SavedPageMapper.toDomain(entity) : null;
	}

	async findByIdAndUser(
		id: string,
		userId: UserId,
	): Promise<DomainSavedPage | null> {
		const entity = await this.repository.findOne({
			where: { id, user: { id: userId.toString() } },
			relations: ['page', 'chapter', 'book'],
		});
		return entity ? SavedPageMapper.toDomain(entity) : null;
	}

	async findByUser(userId: UserId): Promise<DomainSavedPage[]> {
		const entities = await this.repository.find({
			where: { user: { id: userId.toString() } },
			relations: ['page', 'chapter', 'book'],
			order: { createdAt: 'DESC' },
		});
		return entities.map(SavedPageMapper.toDomain);
	}

	async findPublicByUser(userId: UserId): Promise<DomainSavedPage[]> {
		const entities = await this.repository.find({
			where: { user: { id: userId.toString() }, isPublic: true },
			relations: ['page', 'chapter', 'book'],
			order: { createdAt: 'DESC' },
		});
		return entities.map(SavedPageMapper.toDomain);
	}

	async findPublicByBookAndUser(
		userId: UserId,
		bookId: string,
	): Promise<DomainSavedPage[]> {
		const entities = await this.repository.find({
			where: {
				user: { id: userId.toString() },
				book: { id: bookId },
				isPublic: true,
			},
			relations: ['page', 'chapter', 'book'],
			order: { chapter: { index: 'ASC' }, page: { index: 'ASC' } },
		});
		return entities.map(SavedPageMapper.toDomain);
	}

	async findByBookAndUser(
		userId: UserId,
		bookId: string,
	): Promise<DomainSavedPage[]> {
		const entities = await this.repository.find({
			where: { user: { id: userId.toString() }, book: { id: bookId } },
			relations: ['page', 'chapter'],
			order: { chapter: { index: 'ASC' }, page: { index: 'ASC' } },
		});
		return entities.map(SavedPageMapper.toDomain);
	}

	async findByChapterAndUser(
		userId: UserId,
		chapterId: string,
	): Promise<DomainSavedPage[]> {
		const entities = await this.repository.find({
			where: {
				user: { id: userId.toString() },
				chapter: { id: chapterId },
			},
			relations: ['page'],
			order: { page: { index: 'ASC' } },
		});
		return entities.map(SavedPageMapper.toDomain);
	}

	async countByPageAndUser(pageId: number, userId: UserId): Promise<number> {
		return this.repository.count({
			where: { user: { id: userId.toString() }, page: { id: pageId } },
		});
	}

	async countByBookAndUser(userId: UserId, bookId: string): Promise<number> {
		return this.repository.count({
			where: { user: { id: userId.toString() }, book: { id: bookId } },
		});
	}

	async softRemove(savedPage: DomainSavedPage): Promise<void> {
		const entity = SavedPageMapper.toOrm(savedPage);
		await this.repository.softRemove(entity);
	}

	async findForSync(
		userId: UserId,
		lastSyncAt?: Date,
	): Promise<DomainSavedPage[]> {
		const whereClause: FindOptionsWhere<OrmSavedPage> = {
			user: { id: userId.toString() },
		};

		if (lastSyncAt) {
			whereClause.updatedAt = MoreThanOrEqual(lastSyncAt);
		}

		const entities = await this.repository.find({
			where: whereClause,
			withDeleted: !!lastSyncAt,
			relations: ['page', 'chapter', 'book'],
		});

		return entities.map(SavedPageMapper.toDomain);
	}

	async verifyPageOwnership(
		pageId: number,
		chapterId: string,
		bookId: string,
	): Promise<boolean> {
		const page = await this.pageRepository.findOne({
			where: { id: pageId },
			relations: ['chapter', 'chapter.book'],
		});

		if (!page) {
			return false; // Not found
		}

		if (page.chapter?.id !== chapterId) {
			throw new Error('Page does not belong to the specified chapter');
		}

		if (page.chapter?.book?.id !== bookId) {
			throw new Error('Chapter does not belong to the specified book');
		}

		return true;
	}
}
