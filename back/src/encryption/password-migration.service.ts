import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/users/entitys/user.entity';
import { PasswordEncryption } from './password-encryption.provider';

@Injectable()
export class PasswordMigrationService {
    private readonly logger = new Logger(PasswordMigrationService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly passwordEncryption: PasswordEncryption,
    ) {}

    isLegacyHash(hash: string): boolean {
        const currentAlgorithm = this.passwordEncryption.getAlgorithm();

        switch (currentAlgorithm) {
            case 'scrypt':
                return false;

            case 'bcrypt':
                return hash.includes('.') && !hash.startsWith('$');

            case 'argon2':
                return !hash.startsWith('$argon2');

            default:
                return false;
        }
    }

    detectHashAlgorithm(hash: string): string {
        if (hash.startsWith('$argon2')) {
            return 'argon2';
        }
        if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
            return 'bcrypt';
        }
        if (hash.includes('.') && !hash.startsWith('$')) {
            return 'scrypt';
        }
        return 'unknown';
    }

    async migratePasswordOnLogin(user: User, plainPassword: string): Promise<boolean> {
        if (!this.isLegacyHash(user.password)) {
            return false;
        }

        const oldAlgorithm = this.detectHashAlgorithm(user.password);
        const newAlgorithm = this.passwordEncryption.getAlgorithm();

        this.logger.log(
            `Migrando senha do usuário ${user.id} de ${oldAlgorithm} para ${newAlgorithm}`,
        );

        const newHash = await this.passwordEncryption.encrypt(plainPassword);

        await this.userRepository.update(user.id, {
            password: newHash,
        });

        user.password = newHash;

        this.logger.log(
            `Senha do usuário ${user.id} migrada com sucesso para ${newAlgorithm}`,
        );

        return true;
    }

    async getHashingStatistics(): Promise<Record<string, number>> {
        const users = await this.userRepository.find({
            select: ['id', 'password'],
        });

        const stats: Record<string, number> = {
            scrypt: 0,
            bcrypt: 0,
            argon2: 0,
            unknown: 0,
        };

        for (const user of users) {
            const algorithm = this.detectHashAlgorithm(user.password);
            stats[algorithm] = (stats[algorithm] || 0) + 1;
        }

        return stats;
    }

    async forceBulkMigration(sendResetEmail = false): Promise<number> {
        const users = await this.userRepository.find({
            select: ['id', 'email', 'password'],
        });

        let migratedCount = 0;

        for (const user of users) {
            if (this.isLegacyHash(user.password)) {
                this.logger.warn(
                    `Usuário ${user.id} (${user.email}) marcado para reset de senha obrigatório`,
                );

                if (sendResetEmail) {
                    // TODO: Implementar envio de email de reset
                    // await this.emailService.sendPasswordReset(user.email);
                }

                migratedCount++;
            }
        }

        this.logger.log(
            `Migração em lote concluída. ${migratedCount} usuários afetados`,
        );

        return migratedCount;
    }
}
