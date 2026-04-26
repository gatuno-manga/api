import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Page } from '../../../books/infrastructure/database/entities/page.entity';
import { Cover } from '../../../books/infrastructure/database/entities/cover.entity';
import { User } from '../../../users/infrastructure/database/entities/user.entity';
import { UserImage } from '../../../users/infrastructure/database/entities/user-image.entity';
import { StorageBucket } from '../../../common/enum/storage-bucket.enum';
import { ImageMetadata } from '../../../common/domain/value-objects/image-metadata.vo';

interface ImageProcessingCompletedEvent {
	rawPath: string;
	targetBucket: string;
	targetPath: string;
	metadata?: ImageMetadata;
}

@Controller()
export class ImageProcessingController {
	private readonly logger = new Logger(ImageProcessingController.name);

	constructor(
		@InjectRepository(Page)
		private readonly pageRepository: Repository<Page>,
		@InjectRepository(Cover)
		private readonly coverRepository: Repository<Cover>,
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(UserImage)
		private readonly userImageRepository: Repository<UserImage>,
	) {}

	@EventPattern('image.processing.completed')
	async handleImageProcessingCompleted(
		@Payload() data: ImageProcessingCompletedEvent,
	) {
		this.logger.log(
			`Recebido evento de conclusão: ${data.rawPath} -> ${data.targetBucket}/${data.targetPath}`,
		);

		const finalPath = `${data.targetBucket}/${data.targetPath}`;

		try {
			const updateData = {
				path: finalPath,
				...(data.metadata ? { metadata: data.metadata } : {}),
			};

			if (data.targetBucket === StorageBucket.BOOKS) {
				// Atualiza Páginas
				const pageUpdate = await this.pageRepository.update(
					{ path: data.rawPath },
					updateData,
				);

				// Atualiza Capas
				const coverUpdate = await this.coverRepository.update(
					{ url: data.rawPath },
					{
						url: finalPath,
						...(data.metadata ? { metadata: data.metadata } : {}),
					},
				);

				this.logger.log(
					`Update Books: ${pageUpdate.affected} páginas e ${coverUpdate.affected} capas atualizadas`,
				);
			} else if (data.targetBucket === StorageBucket.USERS) {
				// Atualiza Imagens de Usuários (Avatares e Banners) na tabela user_images
				const userImageUpdate = await this.userImageRepository.update(
					{ path: data.rawPath },
					updateData,
				);

				this.logger.log(
					`Update Users: ${userImageUpdate.affected} imagens (avatar/banner) atualizadas na tabela user_images`,
				);
			} else {
				this.logger.warn(
					`Bucket de destino desconhecido para atualização: ${data.targetBucket}`,
				);
			}
		} catch (error) {
			this.logger.error(
				`Erro ao atualizar entidades após processamento de imagem: ${data.rawPath}`,
				error,
			);
		}
	}
}
