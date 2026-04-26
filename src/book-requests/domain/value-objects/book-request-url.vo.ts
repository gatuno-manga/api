export class BookRequestUrl {
	private readonly value: string;

	constructor(value: string) {
		this.validate(value);
		this.value = value;
	}

	private validate(value: string): void {
		if (!value || value.trim().length === 0) {
			throw new Error('URL cannot be empty');
		}
		try {
			new URL(value);
		} catch {
			throw new Error('Invalid URL format');
		}
	}

	getValue(): string {
		return this.value;
	}
}
