import { CollectionRepository } from '@/collections/application/ports/collection-repository.port';
import { CollectionEvents } from '@/collections/domain/constants/events.constant';
import { CollectionId } from '@/collections/domain/value-objects/collection-id.vo';
import { FilesService } from '@/files/application/services/files.service';
import { DomainException } from '@common/domain/exceptions/domain.exception';
import { ResourceNotFoundException } from '@common/domain/exceptions/resource-not-found.exception';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface UploadCoverFile {
	buffer: Buffer;
	mimetype: string;
	size: number;
}

@Injectable()
export class UploadCollectionCoverUseCase {
	private readonly allowedMimeTypes = new Set([
		'image/png',
		'image/jpeg',
		'image/webp',
	]);
	private readonly maxSizeBytes = 5 * 1024 * 1024; // 5MB

	constructor(
		@Inject('CollectionRepository')
		private readonly collectionRepository: CollectionRepository,
		private readonly filesService: FilesService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async execute(
		requesterId: string,
		collectionId: string,
		file: UploadCoverFile,
	): Promise<void> {
		if (!file || !file.buffer || file.size === 0) {
			throw new DomainException('File is empty or not provided');
		}

		if (file.size > this.maxSizeBytes) {
			throw new DomainException('File is too large. Maximum size is 5MB');
		}

		if (!this.allowedMimeTypes.has(file.mimetype)) {
			throw new DomainException(
				'Unsupported format. Use png, jpeg or webp',
			);
		}

		const collection = await this.collectionRepository.findById(
			CollectionId.create(collectionId),
		);
		if (!collection) {
			throw new ResourceNotFoundException('Collection not found');
		}

		const user = UserId.create(requesterId);
		// Verify if user can edit before uploading to avoid orphaned files
		collection.updateCoverUrl(user, ''); // This will throw DomainException if not owner/editor

		const extensionMap: Record<string, string> = {
			'image/png': '.png',
			'image/jpeg': '.jpg',
			'image/webp': '.webp',
		};
		const extension = extensionMap[file.mimetype];

		const publicPath = await this.filesService.saveBufferFile(
			file.buffer,
			extension,
			StorageBucket.BOOKS,
		);

		collection.updateCoverUrl(user, publicPath);
		await this.collectionRepository.save(collection);

		this.eventEmitter.emit(CollectionEvents.UPDATED, {
			collectionId,
			userId: requesterId,
		});
	}
}
