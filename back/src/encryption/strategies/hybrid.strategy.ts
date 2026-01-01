import { Injectable, Inject } from '@nestjs/common';
import { PasswordHasher } from '../interfaces/password-hasher.interface';
import { ScryptStrategy } from './scrypt.strategy';
import { BcryptStrategy } from './bcrypt.strategy';
import { Argon2Strategy } from './argon2.strategy';

@Injectable()
export class HybridStrategy implements PasswordHasher {
	readonly algorithm = 'argon2';

	private readonly strategies: Map<string, PasswordHasher> = new Map();

	constructor(
		@Inject(ScryptStrategy) private readonly scryptStrategy: ScryptStrategy,
		@Inject(BcryptStrategy) private readonly bcryptStrategy: BcryptStrategy,
		@Inject(Argon2Strategy) private readonly argon2Strategy: Argon2Strategy,
	) {
		this.strategies.set('scrypt', this.scryptStrategy);
		this.strategies.set('bcrypt', this.bcryptStrategy);
		this.strategies.set('argon2', this.argon2Strategy);
	}

	private detectAlgorithm(hash: string): string {
		if (hash.startsWith('$argon2')) {
			return 'argon2';
		}
		if (
			hash.startsWith('$2a$') ||
			hash.startsWith('$2b$') ||
			hash.startsWith('$2y$')
		) {
			return 'bcrypt';
		}
		if (hash.includes('.') && !hash.startsWith('$')) {
			return 'scrypt';
		}
		return 'unknown';
	}

	async hash(password: string): Promise<string> {
		return this.argon2Strategy.hash(password);
	}

	async compare(password: string, hash: string): Promise<boolean> {
		const algorithm = this.detectAlgorithm(hash);

		if (algorithm === 'unknown') {
			return false;
		}

		const strategy = this.strategies.get(algorithm);

		if (!strategy) {
			return false;
		}

		return strategy.compare(password, hash);
	}
}
