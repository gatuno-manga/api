import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PasswordHasher } from '../interfaces/password-hasher.interface';
import { AppConfigService } from 'src/app-config/app-config.service';

@Injectable()
export class Argon2Strategy implements PasswordHasher {
    readonly algorithm = 'argon2';
    private options: argon2.Options = {};

    constructor(
        private readonly config: AppConfigService,
    ) {
        this.options = {
            type: argon2.argon2id,
            memoryCost: 65536, // 64 MB
            timeCost: 3,       // 3 iterações
            parallelism: 4,    // 4 threads
            hashLength: this.config.passwordKeyLength,    // Tamanho do hash em bytes
        };
    }

    async hash(password: string): Promise<string> {
        return argon2.hash(password, this.options);
    }

    async compare(password: string, hash: string): Promise<boolean> {
        try {
            return argon2.verify(hash, password);
        } catch (error) {
            return false;
        }
    }
}
