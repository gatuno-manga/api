import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PasswordHasher } from '../interfaces/password-hasher.interface';
import { AppConfigService } from 'src/app-config/app-config.service';

@Injectable()
export class BcryptStrategy implements PasswordHasher {
	readonly algorithm = 'bcrypt';

	constructor(private readonly config: AppConfigService) {}

	async hash(password: string): Promise<string> {
		return bcrypt.hash(password, this.config.saltLength);
	}

	async compare(password: string, hash: string): Promise<boolean> {
		try {
			return bcrypt.compare(password, hash);
		} catch (error) {
			return false;
		}
	}
}
