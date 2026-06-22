import { CollectionRepository } from '@/collections/application/ports/collection-repository.port';
import { DeleteCollectionUseCase } from '@/collections/application/use-cases/delete-collection.use-case';
import { CollectionEvents } from '@/collections/domain/constants/events.constant';
import { Collection } from '@/collections/domain/entities/collection';
import { CollectionId } from '@/collections/domain/value-objects/collection-id.vo';
import { DomainException } from '@common/domain/exceptions/domain.exception';
import { ResourceNotFoundException } from '@common/domain/exceptions/resource-not-found.exception';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('DeleteCollectionUseCase', () => {
	let useCase: DeleteCollectionUseCase;
	let mockRepository: jest.Mocked<CollectionRepository>;
	let mockEventEmitter: jest.Mocked<EventEmitter2>;

	beforeEach(() => {
		mockRepository = {
			findById: jest.fn(),
			delete: jest.fn(),
			save: jest.fn(),
			findByUserId: jest.fn(),
			findPublicCollections: jest.fn(),
		} as any;

		mockEventEmitter = {
			emit: jest.fn(),
		} as any;

		useCase = new DeleteCollectionUseCase(mockRepository, mockEventEmitter);
	});

	it('should delete a collection if requester is the owner', async () => {
		// Arrange
		const ownerId = UserId.generate();
		const collectionId = CollectionId.generate();
		const collection = Collection.create(ownerId, 'My Collection');
		mockRepository.findById.mockResolvedValue(collection);

		// Act
		await useCase.execute(ownerId.toString(), collectionId.toString());

		// Assert
		expect(mockRepository.findById).toHaveBeenCalled();
		expect(mockRepository.delete).toHaveBeenCalled();
		expect(mockEventEmitter.emit).toHaveBeenCalledWith(
			CollectionEvents.DELETED,
			collection,
		);
	});

	it('should throw ResourceNotFoundException if collection does not exist', async () => {
		// Arrange
		const requesterId = UserId.generate().toString();
		const collectionId = CollectionId.generate().toString();
		mockRepository.findById.mockResolvedValue(null);

		// Act & Assert
		await expect(
			useCase.execute(requesterId, collectionId),
		).rejects.toThrow(ResourceNotFoundException);
		expect(mockRepository.delete).not.toHaveBeenCalled();
		expect(mockEventEmitter.emit).not.toHaveBeenCalled();
	});

	it('should throw DomainException if requester is not the owner', async () => {
		// Arrange
		const ownerId = UserId.generate();
		const requesterId = UserId.generate().toString();
		const collectionId = CollectionId.generate().toString();
		const collection = Collection.create(ownerId, 'My Collection');
		mockRepository.findById.mockResolvedValue(collection);

		// Act & Assert
		await expect(
			useCase.execute(requesterId, collectionId),
		).rejects.toThrow(DomainException);
		expect(mockRepository.delete).not.toHaveBeenCalled();
		expect(mockEventEmitter.emit).not.toHaveBeenCalled();
	});
});
