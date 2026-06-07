import { DomainException } from '@common/domain/exceptions/domain.exception';
export class BookRequestUrl {
	private readonly value: string;

	constructor(value: string) {
		this.validate(value);
		this.value = value;
	}

	private validate(value: string): void {
		if (!value || value.trim().length === 0) {
			throw new DomainException('URL cannot be empty');
		}
		try {
			new URL(value);
		} catch {
			throw new DomainException('Invalid URL format');
		}
	}

	getValue(): string {
		return this.value;
	}
}
