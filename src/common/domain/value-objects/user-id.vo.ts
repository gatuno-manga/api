import { Uuid } from './uuid.vo';

export class UserId extends Uuid {
	public static create(value: string): UserId {
		return new UserId(value);
	}

	public static generate(): UserId {
		return new UserId(Uuid.generateValue());
	}
}
