import { validate as validateUuid, v7 as uuidv7 } from 'uuid';

export abstract class Uuid {
	protected constructor(protected readonly value: string) {
		if (!validateUuid(value)) {
			throw new Error(`Invalid UUID: ${value}`);
		}
	}

	public static generateValue(): string {
		return uuidv7();
	}

	public equals(other: Uuid): boolean {
		return this.value === other.toString();
	}

	public toString(): string {
		return this.value;
	}
}
