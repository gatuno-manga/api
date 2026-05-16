export class RatingScore {
	private constructor(private readonly value: number) {
		if (value < 1 || value > 5) {
			throw new Error('Rating score must be between 1 and 5');
		}
		if (!Number.isInteger(value)) {
			throw new Error('Rating score must be an integer');
		}
	}

	public static create(value: number): RatingScore {
		return new RatingScore(value);
	}

	public toNumber(): number {
		return this.value;
	}

	public equals(other: RatingScore): boolean {
		return this.value === other.toNumber();
	}
}
