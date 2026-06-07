import { DomainException } from '@common/domain/exceptions/domain.exception';
import { v7 as uuidv7, validate as validateUuid } from 'uuid';

export abstract class Uuid {
	protected constructor(protected readonly value: string) {
		if (!validateUuid(value)) {
			throw new DomainException(`Invalid UUID: ${value}`);
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
