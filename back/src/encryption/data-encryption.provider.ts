import { scrypt as _scrypt, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import { AppConfigService } from 'src/app-config/app-config.service';

const scrypt = promisify(_scrypt);
@Injectable()
export class DataEncryptionProvider {
	constructor(private readonly config: AppConfigService) {}
	async encrypt(password: string): Promise<string> {
		const salt = randomBytes(this.config.saltLength).toString('hex');
		const hash = (await scrypt(
			password,
			salt,
			this.config.passwordKeyLength,
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
			this.config.passwordKeyLength,
		)) as Buffer;
		return hashBuffer.toString('hex') === hash;
	}
}
