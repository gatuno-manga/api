import { DomainException } from '@common/domain/exceptions/domain.exception';
export class BookRequestTitle {
	private readonly value: string;

	constructor(value: string) {
		this.validate(value);
		this.value = value;
	}

	private validate(value: string): void {
		if (!value || value.trim().length === 0) {
			throw new DomainException('Title cannot be empty');
		}
	}

	getValue(): string {
		return this.value;
	}
}
