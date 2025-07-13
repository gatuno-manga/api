import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt as _scrypt } from 'crypto';
import { AppConfigService } from 'src/app-config/app-config.service';
import { promisify } from 'util';

const scrypt = promisify(_scrypt);

@Injectable()
export class PasswordEncryption {
	constructor(private readonly config: AppConfigService) {}
	async encrypt(password: string): Promise<string> {
		const salt = randomBytes(this.config.SaltLength).toString('hex');
		const hash = (await scrypt(
			password,
			salt,
			this.config.PasswordKeyLength,
		)) as Buffer;
		return `${hash.toString('hex')}.${salt}`;
	}
	async compare(
		storedPassword: string,
		suppliedPassword: string,
	): Promise<boolean> {
		const [hash, salt] = storedPassword.split('.');
		const hashBuffer = (await scrypt(
			suppliedPassword,
			salt,
			this.config.PasswordKeyLength,
		)) as Buffer;
		return hashBuffer.toString('hex') === hash;
	}
}
