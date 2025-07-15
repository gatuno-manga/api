import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataEncryptionProvider } from 'src/encryption/data-encryption.provider';
import { PasswordEncryption } from 'src/encryption/password-encryption.provider';
import { User } from 'src/users/entitys/user.entity';
import { Roles } from 'src/users/enum/roles.enum';
import { Repository } from 'typeorm';
import { Cache } from 'cache-manager';
import { AppConfigService } from 'src/app-config/app-config.service';
@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly passwordEncryption: PasswordEncryption,
        private readonly DataEncryption: DataEncryptionProvider,
        private readonly jwtService: JwtService,
        private readonly configService: AppConfigService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) {}

    private getRedisKey(userId: string): string {
        return `user-tokens:${userId}`;
    }

    private async storeRefreshToken(userId: string, token: string) {
        const key = this.getRedisKey(userId);
        const hashedToken = await this.DataEncryption.encrypt(token);
        const ttl = 7 * 24 * 60 * 60; // 7 dias em segundos

        const storedTokens: string[] = await this.cacheManager.get(key) || [];
        storedTokens.push(hashedToken);
        await this.cacheManager.set(key, storedTokens, ttl);
    }

    async signUp(email: string, password: string, isAdmin = false) {
        const userExist = await this.userRepository.findOneBy({ email });
        if (userExist) {
            this.logger.error('User exists', userExist);
            throw new BadRequestException('User already exists');
        }

        const result = await this.passwordEncryption.encrypt(password);
        const user = await this.userRepository.save({
            userName: email.split('@')[0],
            email,
            password: result,
            roles: isAdmin ? [Roles.ADMIN] : [Roles.USER],
        })
        this.logger.log('User create', user);
        return user;
    }

    private async getTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
        const payload = {
            sub: user.id,
            iss: 'login',
            email: user.email,
            roles: user.roles
        }
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(
                payload,
                {
                    secret: this.configService.jwtAccessSecret,
                    expiresIn: this.configService.jwtAccessExpiration,
                },
            ),
            this.jwtService.signAsync(
                payload,
                {
                    secret: this.configService.jwtRefreshSecret,
                    expiresIn: this.configService.jwtRefreshExpiration,
                },
            ),
        ]);

        return {
            accessToken,
            refreshToken,
        };
    }

    async signIn(email: string, password: string) {
        const user = await this.userRepository.findOne({
            where: { email },
            select: ['id', 'email', 'password', 'roles'],
        });
        if (!user) {
            this.logger.error('User not exists', email);
            throw new UnauthorizedException('User not exists');
        }

        if (!(await this.passwordEncryption.compare(user.password, password))) {
            this.logger.error('Invalid password', email);
            throw new UnauthorizedException('Invalid password');
        }

        const tokens = await this.getTokens(user);
        await this.storeRefreshToken(user.id, tokens.refreshToken);
        return tokens;
    }

    async logout(userId: string, refreshToken: string) {
        const key = this.getRedisKey(userId);
        const storedTokens: string[] = await this.cacheManager.get(key) || [];
        let index = -1;
        for (let i = 0; i < storedTokens.length; i++) {
            if (await this.DataEncryption.compare(storedTokens[i], refreshToken)) {
                index = i;
                break;
            }
        }
        if (index === -1) {
            this.logger.error('Token not found in cache', { userId, refreshToken });
            throw new UnauthorizedException('Invalid token');
        }
        storedTokens.splice(index, 1);
        if (storedTokens.length === 0) {
            await this.cacheManager.del(key);
        } else {
            await this.cacheManager.set(key, storedTokens, 7 * 24 * 60 * 60 * 1000); // Reset TTL
        }
        return { message: 'Logged out successfully' };
    }

    async logoutAll(userId: string) {
        const key = this.getRedisKey(userId);
        const storedTokens: string[] = await this.cacheManager.get(key) || [];
        if (storedTokens.length === 0) {
            throw new UnauthorizedException('No active sessions found');
        }

        await this.cacheManager.del(key);
        return { message: 'All sessions logged out successfully' };
    }

    async refreshTokens(
        userId: string,
        oldRefreshToken: string,
    ) {
        const key = this.getRedisKey(userId);
        const storedHashes: string[] = await this.cacheManager.get(key) || [];

        if (storedHashes.length === 0) {
            throw new UnauthorizedException('No valid session found');
        }
        let match = false;
        let indexToRemove = -1;
        for (let i = 0; i < storedHashes.length; i++) {
            if (await this.DataEncryption.compare(storedHashes[i], oldRefreshToken)) {
                match = true;
                indexToRemove = i;
                break;
            }
        }
        if (!match) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        if (indexToRemove > -1) {
            storedHashes.splice(indexToRemove, 1);
        }

        const user = await this.userRepository.findOneBy({ id: userId });
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        const tokens = await this.getTokens(user);
        await this.storeRefreshToken(user.id, tokens.refreshToken);
        const newHashedToken = await this.DataEncryption.encrypt(tokens.refreshToken);
        storedHashes.push(newHashedToken);
        await this.cacheManager.set(key, storedHashes, 7 * 24 * 60 * 60);
        return tokens;
    }
}
