import { PasswordHasher } from '@encryption/interfaces/password-hasher.interface';
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';

@Injectable()
export class BcryptStrategy implements PasswordHasher {
	readonly algorithm = 'bcrypt';

	constructor(private readonly config: AppConfigService) {}

	async hash(password: string): Promise<string> {
		return bcrypt.hash(password, this.config.security.saltLength);
	}

	async compare(password: string, hash: string): Promise<boolean> {
		try {
			return bcrypt.compare(password, hash);
		} catch (_error) {
			return false;
		}
	}
}
