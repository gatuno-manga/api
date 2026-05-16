import { CollectionId } from '@/collections/domain/value-objects/collection-id.vo';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Visibility } from '@/collections/domain/value-objects/visibility.vo';
import { CollaboratorList } from '@/collections/domain/value-objects/collaborator-list.vo';
import { BookIdList } from '@/collections/domain/value-objects/book-id-list.vo';
import { BookId } from '@common/domain/value-objects/book-id.vo';

export interface CollectionSnapshot {
	id: string;
	ownerId: string;
	title: string;
	description: string | null;
	visibility: string;
	collaborators: string[];
	books: string[];
	createdAt: Date;
	updatedAt: Date;
}

export class Collection {
	private constructor(
		private readonly id: CollectionId,
		private readonly ownerId: UserId,
		private title: string,
		private description: string | null,
		private visibility: Visibility,
		private readonly collaborators: CollaboratorList,
		private readonly books: BookIdList,
		private readonly createdAt: Date,
		private readonly updatedAt: Date,
	) {}

	public static create(
		ownerId: UserId,
		title: string,
		description: string | null = null,
	): Collection {
		const now = new Date();
		return new Collection(
			CollectionId.generate(),
			ownerId,
			title,
			description,
			Visibility.private(),
			CollaboratorList.create(),
			BookIdList.create(),
			now,
			now,
		);
	}

	public static restore(snapshot: CollectionSnapshot): Collection {
		return new Collection(
			CollectionId.create(snapshot.id),
			UserId.create(snapshot.ownerId),
			snapshot.title,
			snapshot.description,
			Visibility.create(snapshot.visibility),
			CollaboratorList.create(
				snapshot.collaborators.map((id) => UserId.create(id)),
			),
			BookIdList.create(snapshot.books.map((id) => BookId.create(id))),
			snapshot.createdAt,
			snapshot.updatedAt,
		);
	}

	public addCollaborator(
		requesterId: UserId,
		newCollaboratorId: UserId,
	): void {
		if (!this.ownerId.equals(requesterId)) {
			throw new Error('Only the owner can add collaborators');
		}
		this.collaborators.add(newCollaboratorId);
		this.visibility = Visibility.shared();
	}

	public removeCollaborator(
		requesterId: UserId,
		collaboratorId: UserId,
	): void {
		if (!this.ownerId.equals(requesterId)) {
			throw new Error('Only the owner can remove collaborators');
		}
		this.collaborators.remove(collaboratorId);
		if (this.collaborators.count() === 0 && this.visibility.isShared()) {
			this.visibility = Visibility.private();
		}
	}

	public addBook(requesterId: UserId, bookId: BookId): void {
		if (!this.canEdit(requesterId)) {
			throw new Error(
				'User does not have permission to edit this collection',
			);
		}
		this.books.add(bookId);
	}

	public removeBook(requesterId: UserId, bookId: BookId): void {
		if (!this.canEdit(requesterId)) {
			throw new Error(
				'User does not have permission to edit this collection',
			);
		}
		this.books.remove(bookId);
	}

	public updateTitle(requesterId: UserId, newTitle: string): void {
		if (!this.ownerId.equals(requesterId)) {
			throw new Error('Only the owner can update the title');
		}
		this.title = newTitle;
	}

	public updateVisibility(
		requesterId: UserId,
		newVisibility: Visibility,
	): void {
		if (!this.ownerId.equals(requesterId)) {
			throw new Error('Only the owner can update visibility');
		}
		this.visibility = newVisibility;
	}

	public toSnapshot(): CollectionSnapshot {
		return {
			id: this.id.toString(),
			ownerId: this.ownerId.toString(),
			title: this.title,
			description: this.description,
			visibility: this.visibility.toString(),
			collaborators: this.collaborators
				.toArray()
				.map((id) => id.toString()),
			books: this.books.toArray().map((id) => id.toString()),
			createdAt: this.createdAt,
			updatedAt: this.updatedAt,
		};
	}

	private canEdit(userId: UserId): boolean {
		return (
			this.ownerId.equals(userId) || this.collaborators.contains(userId)
		);
	}
}
