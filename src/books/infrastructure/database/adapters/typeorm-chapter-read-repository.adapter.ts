import { IChapterReadRepository } from '@books/application/ports/chapter-read-repository.interface';
import { ChapterRead as DomainChapterRead } from '@books/domain/entities/chapter-read';
import { ChapterReadCriteria } from '@books/domain/types/criteria.types';
import { ChapterRead as InfrastructureChapterRead } from '@books/infrastructure/database/entities/chapter-read.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';

@Injectable()
export class TypeOrmChapterReadRepositoryAdapter
	implements IChapterReadRepository
{
	constructor(
		@InjectRepository(InfrastructureChapterRead)
		private readonly repository: Repository<InfrastructureChapterRead>,
	) {}

	async save(chapterRead: DomainChapterRead): Promise<DomainChapterRead> {
		const saved = await this.repository.save(
			chapterRead as unknown as InfrastructureChapterRead,
		);
		return saved as DomainChapterRead;
	}

	async findOneBy(
		criteria: ChapterReadCriteria,
	): Promise<DomainChapterRead | null> {
		const read = await this.repository.findOneBy(
			criteria as FindOptionsWhere<InfrastructureChapterRead>,
		);
		return read as DomainChapterRead | null;
	}

	async delete(criteria: ChapterReadCriteria): Promise<void> {
		await this.repository.delete(
			criteria as FindOptionsWhere<InfrastructureChapterRead>,
		);
	}

	async findReadChapterIds(
		userId: string,
		chapterIds: string[],
	): Promise<string[]> {
		if (chapterIds.length === 0) return [];
		const rows = await this.repository
			.createQueryBuilder('cr')
			.select('cr.chapterId', 'chapterId')
			.where('cr.userId = :userId', { userId })
			.andWhere('cr.chapterId IN (:...chapterIds)', { chapterIds })
			.getRawMany<{ chapterId: string }>();
		return rows.map((row) => row.chapterId);
	}

	create(data: Partial<DomainChapterRead>): DomainChapterRead {
		return this.repository.create(
			data as DeepPartial<InfrastructureChapterRead>,
		) as DomainChapterRead;
	}
}
