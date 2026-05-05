import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In } from 'typeorm';
import { IUserImageRepository } from '../../../application/ports/user-image-repository.interface';
import { UserImage as DomainUserImage } from '../../../domain/entities/user-image';
import { UserImage as InfrastructureUserImage } from '../entities/user-image.entity';
import { ImageMetadata } from '../../../../common/domain/value-objects/image-metadata.vo';

@Injectable()
export class TypeOrmUserImageRepositoryAdapter implements IUserImageRepository {
	constructor(
		@InjectRepository(InfrastructureUserImage)
		private readonly repository: Repository<InfrastructureUserImage>,
	) {}

	async update(
		criteria: unknown,
		data: Partial<DomainUserImage>,
	): Promise<void> {
		await this.repository.update(
			criteria as FindOptionsWhere<InfrastructureUserImage>,
			data as unknown as InfrastructureUserImage,
		);
	}

	async updateBatch(
		updates: { oldPath: string; newPath: string; metadata?: unknown }[],
	): Promise<void> {
		const oldPaths = updates.map((u) => u.oldPath);
		const userImages = await this.repository.find({
			where: {
				path: In(oldPaths),
			} as unknown as FindOptionsWhere<InfrastructureUserImage>,
		});

		for (const userImage of userImages) {
			const update = updates.find((u) => u.oldPath === userImage.path);
			if (update) {
				userImage.path = update.newPath;
				if (update.metadata) {
					userImage.metadata = update.metadata as ImageMetadata;
				}
			}
		}

		await this.repository.save(userImages);
	}
}
