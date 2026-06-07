import { BadRequestException } from '@nestjs/common';

export class PlainPasswordVO {
	private readonly _value: string;

	constructor(value: string) {
		this.validate(value);
		this._value = value;
	}

	get value(): string {
		return this._value;
	}

	private validate(value: string): void {
		if (!value || value.trim() === '') {
			throw new BadRequestException('Password cannot be empty');
		}

		if (value.length < 8) {
			throw new BadRequestException(
				'Password must be at least 8 characters long',
			);
		}

		// Additional complexity requirements could go here
		// Example: require at least one number and one uppercase letter
		// if (!/[A-Z]/.test(value) || !/[0-9]/.test(value)) {
		// 	throw new BadRequestException('Password must contain at least one uppercase letter and one number');
		// }
	}
}
