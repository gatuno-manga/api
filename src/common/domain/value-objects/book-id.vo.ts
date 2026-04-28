import { Uuid } from './uuid.vo';

export class BookId extends Uuid {
	public static create(value: string): BookId {
		return new BookId(value);
	}

	public static generate(): BookId {
		return new BookId(Uuid.generateValue());
	}
}
