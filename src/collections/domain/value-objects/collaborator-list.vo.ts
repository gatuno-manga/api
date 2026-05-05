import { UserId } from '@common/domain/value-objects/user-id.vo';

export class CollaboratorList {
	private constructor(private readonly collaboratorIds: UserId[]) {}

	public static create(ids: UserId[] = []): CollaboratorList {
		return new CollaboratorList([...ids]);
	}

	public add(userId: UserId): void {
		if (this.contains(userId)) {
			return;
		}
		this.collaboratorIds.push(userId);
	}

	public remove(userId: UserId): void {
		const index = this.collaboratorIds.findIndex((id) => id.equals(userId));
		if (index !== -1) {
			this.collaboratorIds.splice(index, 1);
		}
	}

	public contains(userId: UserId): boolean {
		return this.collaboratorIds.some((id) => id.equals(userId));
	}

	public toArray(): UserId[] {
		return [...this.collaboratorIds];
	}

	public count(): number {
		return this.collaboratorIds.length;
	}
}
