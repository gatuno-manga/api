import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Page } from '../../../books/infrastructure/database/entities/page.entity';
import { Cover } from '../../../books/infrastructure/database/entities/cover.entity';
import { User } from '../../../users/infrastructure/database/entities/user.entity';
import { StorageBucket } from '../../../common/enum/storage-bucket.enum';

interface ImageProcessingCompletedEvent {
	rawPath: string;
	targetBucket: string;
	targetPath: string;
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
			if (data.targetBucket === StorageBucket.BOOKS) {
				// Atualiza Páginas
				const pageUpdate = await this.pageRepository.update(
					{ path: data.rawPath },
					{ path: finalPath },
				);

				// Atualiza Capas
				const coverUpdate = await this.coverRepository.update(
					{ url: data.rawPath },
					{ url: finalPath },
				);

				this.logger.log(
					`Update Books: ${pageUpdate.affected} páginas e ${coverUpdate.affected} capas atualizadas`,
				);
			} else if (data.targetBucket === StorageBucket.USERS) {
				// Atualiza Avatares e Banners (Entity User usa profileImagePath e profileBannerPath)
				const avatarUpdate = await this.userRepository.update(
					{ profileImagePath: data.rawPath },
					{ profileImagePath: finalPath },
				);

				const bannerUpdate = await this.userRepository.update(
					{ profileBannerPath: data.rawPath },
					{ profileBannerPath: finalPath },
				);

				this.logger.log(
					`Update Users: ${avatarUpdate.affected} avatares e ${bannerUpdate.affected} banners atualizados`,
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
