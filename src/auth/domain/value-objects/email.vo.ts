import { BadRequestException } from '@nestjs/common';

export class EmailVO {
	private readonly _value: string;

	constructor(value: string) {
		if (!this.isValid(value)) {
			throw new BadRequestException('Invalid email format');
		}
		this._value = value.toLowerCase();
	}

	private isValid(email: string): boolean {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	}

	get value(): string {
		return this._value;
	}

	equals(other: EmailVO): boolean {
		return this._value === other.value;
	}
}
