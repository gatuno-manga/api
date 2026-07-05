import { ImageMetadata } from '@common/domain/value-objects/image-metadata.vo';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IUserImageRepository } from '@users/application/ports/user-image-repository.interface';
import { UserImage as DomainUserImage } from '@users/domain/entities/user-image';
import { UserImage as InfrastructureUserImage } from '@users/infrastructure/database/entities/user-image.entity';
import { FindOptionsWhere, In, Repository } from 'typeorm';

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
			data as Partial<InfrastructureUserImage>,
		);
	}

	async updateBatch(
		updates: { oldPath: string; newPath: string; metadata?: unknown }[],
	): Promise<void> {
		const oldPaths = updates.map((u) => u.oldPath);
		const userImages = await this.repository.find({
			where: {
				path: In(oldPaths),
			} as FindOptionsWhere<InfrastructureUserImage>,
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
