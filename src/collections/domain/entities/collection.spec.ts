import { Collection } from './collection';
import { UserId } from '../../../common/domain/value-objects/user-id.vo';
import { BookId } from '../../../common/domain/value-objects/book-id.vo';

describe('Collection Domain Entity', () => {
	it('should create a collection', () => {
		const ownerId = UserId.generate();
		const collection = Collection.create(ownerId, 'My Collection');
		const snapshot = collection.toSnapshot();

		expect(snapshot.title).toBe('My Collection');
		expect(snapshot.ownerId).toBe(ownerId.toString());
		expect(snapshot.visibility).toBe('PRIVATE');
	});

	it('should add a book to the collection', () => {
		const ownerId = UserId.generate();
		const bookId = BookId.generate();
		const collection = Collection.create(ownerId, 'My Collection');

		collection.addBook(ownerId, bookId);
		const snapshot = collection.toSnapshot();

		expect(snapshot.books).toContain(bookId.toString());
	});

	it('should add a collaborator and change visibility to SHARED', () => {
		const ownerId = UserId.generate();
		const collaboratorId = UserId.generate();
		const collection = Collection.create(ownerId, 'My Collection');

		collection.addCollaborator(ownerId, collaboratorId);
		const snapshot = collection.toSnapshot();

		expect(snapshot.collaborators).toContain(collaboratorId.toString());
		expect(snapshot.visibility).toBe('SHARED');
	});

	it('should throw error when non-owner tries to add collaborator', () => {
		const ownerId = UserId.generate();
		const otherUserId = UserId.generate();
		const collection = Collection.create(ownerId, 'My Collection');

		expect(() =>
			collection.addCollaborator(otherUserId, UserId.generate()),
		).toThrow();
	});
});
