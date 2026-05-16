export class BookRequestTitle {
	private readonly value: string;

	constructor(value: string) {
		this.validate(value);
		this.value = value;
	}

	private validate(value: string): void {
		if (!value || value.trim().length === 0) {
			throw new Error('Title cannot be empty');
		}
	}

	getValue(): string {
		return this.value;
	}
}
