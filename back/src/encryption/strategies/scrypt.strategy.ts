import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt as _scrypt } from 'crypto';
import { promisify } from 'util';
import { AppConfigService } from 'src/app-config/app-config.service';
import { PasswordHasher } from '../interfaces/password-hasher.interface';

const scrypt = promisify(_scrypt);


@Injectable()
export class ScryptStrategy implements PasswordHasher {
    readonly algorithm = 'scrypt';

    constructor(private readonly config: AppConfigService) {}

    async hash(password: string): Promise<string> {
        const salt = randomBytes(this.config.saltLength).toString('hex');
        const hash = (await scrypt(
            password,
            salt,
            this.config.passwordKeyLength,
        )) as Buffer;
        return `${hash.toString('hex')}.${salt}`;
    }

    async compare(password: string, hash: string): Promise<boolean> {
        const [storedHash, salt] = hash.split('.');
        if (!storedHash || !salt) {
            return false;
        }

        const hashBuffer = (await scrypt(
            password,
            salt,
            this.config.passwordKeyLength,
        )) as Buffer;

        return hashBuffer.toString('hex') === storedHash;
    }
}
