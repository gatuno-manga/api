export class RejectionMessage {
	private readonly value: string | null;

	constructor(value: string | null | undefined) {
		this.value = value ?? null;
	}

	getValue(): string | null {
		return this.value;
	}
}
