import { BookId } from '@common/domain/value-objects/book-id.vo';

export class BookIdList {
	private constructor(private readonly bookIds: BookId[]) {}

	public static create(ids: BookId[] = []): BookIdList {
		return new BookIdList([...ids]);
	}

	public add(bookId: BookId): void {
		if (this.contains(bookId)) {
			return;
		}
		this.bookIds.push(bookId);
	}

	public remove(bookId: BookId): void {
		const index = this.bookIds.findIndex((id) => id.equals(bookId));
		if (index !== -1) {
			this.bookIds.splice(index, 1);
		}
	}

	public contains(bookId: BookId): boolean {
		return this.bookIds.some((id) => id.equals(bookId));
	}

	public toArray(): BookId[] {
		return [...this.bookIds];
	}

	public count(): number {
		return this.bookIds.length;
	}
}
