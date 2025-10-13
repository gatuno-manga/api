import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataEncryptionProvider } from 'src/encryption/data-encryption.provider';
import { PasswordEncryption } from 'src/encryption/password-encryption.provider';
import { User } from 'src/users/entitys/user.entity';
import { Repository } from 'typeorm';
import { Cache } from 'cache-manager';
import { AppConfigService } from 'src/app-config/app-config.service';
import { Role } from 'src/users/entitys/role.entity';
import { StoredTokenDto } from './dto/stored-token.dto';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Role)
        private readonly roleRepository: Repository<Role>,
        private readonly passwordEncryption: PasswordEncryption,
        private readonly DataEncryption: DataEncryptionProvider,
        private readonly jwtService: JwtService,
        private readonly configService: AppConfigService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) {}

    private getRedisKey(userId: string): string {
        return `user-tokens:${userId}`;
    }

    private async storeRefreshToken(userId: string, token: string): Promise<void> {
        const key = this.getRedisKey(userId);
        const hashedToken = await this.DataEncryption.encrypt(token);
        const ttl = this.configService.refreshTokenTtl;
        const expiresAt = Date.now() + ttl;

        const storedTokens: StoredTokenDto[] = (await this.cacheManager.get(key)) || [];

        const validTokens = storedTokens.filter(t => t.expiresAt > Date.now());

        validTokens.push({ hash: hashedToken, expiresAt });

        const nextExpiration = Math.min(...validTokens.map(t => t.expiresAt));
        const cacheTtl = Math.max(nextExpiration - Date.now(), 0);

        await this.cacheManager.set(key, validTokens, cacheTtl);
        this.logger.log(`Stored refresh token for user ${userId}. Total tokens: ${validTokens.length}`);
    }

    async signUp(email: string, password: string, isAdmin = false) {
        const userExist = await this.userRepository.findOneBy({ email });
        if (userExist) {
            this.logger.error('User exists', userExist);
            throw new BadRequestException('User already exists');
        }

        const result = await this.passwordEncryption.encrypt(password);
        const roleName = isAdmin ? 'admin' : 'user';
        const role = await this.roleRepository.findOne({ where: { name: roleName } });
        if (!role) {
            throw new BadRequestException(`${roleName.charAt(0).toUpperCase() + roleName.slice(1)} role not found`);
        }
        const user = await this.userRepository.save({
            userName: email.split('@')[0],
            email,
            password: result,
            roles: [role],
        });

        const userWithRoles = await this.userRepository.findOne({
            where: { id: user.id },
            relations: ['roles'],
        });

        this.logger.log('User created', userWithRoles);
        return userWithRoles;
    }

    private async getTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
        if (!user.roles || user.roles.length === 0) {
            throw new BadRequestException('User has no roles assigned');
        }

        const maxWeightSensitiveContent = Math.max(
            ...user.roles.map(role => role.maxWeightSensitiveContent ?? 0)
        );
        const payload = {
            sub: user.id,
            iss: 'login',
            email: user.email,
            roles: user.roles.map(role => role.name),
            maxWeightSensitiveContent: maxWeightSensitiveContent
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
            relations: ['roles'],
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
        if (!refreshToken) {
            throw new UnauthorizedException('Refresh token is required');
        }

        const key = this.getRedisKey(userId);
        const storedTokens: StoredTokenDto[] = (await this.cacheManager.get(key)) || [];

        const validTokens = storedTokens.filter(t => t.expiresAt > Date.now());

        if (validTokens.length === 0) {
            this.logger.warn('No tokens found in cache for user', { userId });
            throw new UnauthorizedException('No active sessions found');
        }

        let index = -1;
        for (let i = 0; i < validTokens.length; i++) {
            if (await this.DataEncryption.compare(validTokens[i].hash, refreshToken)) {
                index = i;
                break;
            }
        }

        if (index === -1) {
            this.logger.error('Token not found in cache', { userId });
            throw new UnauthorizedException('Invalid token');
        }

        validTokens.splice(index, 1);

        if (validTokens.length === 0) {
            await this.cacheManager.del(key);
            this.logger.log(`All tokens removed for user ${userId}`);
        } else {
            const nextExpiration = Math.min(...validTokens.map(t => t.expiresAt));
            const cacheTtl = Math.max(nextExpiration - Date.now(), 0);
            await this.cacheManager.set(key, validTokens, cacheTtl);
            this.logger.log(`Token removed for user ${userId}. Remaining tokens: ${validTokens.length}`);
        }

        return { message: 'Logged out successfully' };
    }

    async logoutAll(userId: string) {
        const key = this.getRedisKey(userId);
        const storedTokens: StoredTokenDto[] = (await this.cacheManager.get(key)) || [];

        const validTokens = storedTokens.filter(t => t.expiresAt > Date.now());

        if (validTokens.length === 0) {
            this.logger.warn('No active sessions found for user', { userId });
            throw new UnauthorizedException('No active sessions found');
        }

        await this.cacheManager.del(key);
        this.logger.log(`All sessions (${validTokens.length}) logged out for user ${userId}`);
        return { message: 'All sessions logged out successfully' };
    }

    async refreshTokens(
        userId: string,
        oldRefreshToken: string,
    ) {
        if (!oldRefreshToken) {
            throw new UnauthorizedException('Refresh token is required');
        }

        const key = this.getRedisKey(userId);
        const storedTokens: StoredTokenDto[] = (await this.cacheManager.get(key)) || [];

        const validTokens = storedTokens.filter(t => t.expiresAt > Date.now());

        if (validTokens.length === 0) {
            this.logger.warn('No valid session found for user', { userId });
            throw new UnauthorizedException('No valid session found');
        }

        let match = false;
        let indexToRemove = -1;
        for (let i = 0; i < validTokens.length; i++) {
            if (await this.DataEncryption.compare(validTokens[i].hash, oldRefreshToken)) {
                match = true;
                indexToRemove = i;
                break;
            }
        }

        if (!match) {
            this.logger.error('Invalid refresh token for user', { userId });
            throw new UnauthorizedException('Invalid refresh token');
        }

        if (indexToRemove > -1) {
            validTokens.splice(indexToRemove, 1);
        }

        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['roles'],
        });

        if (!user) {
            this.logger.error('User not found during token refresh', { userId });
            throw new UnauthorizedException('User not found');
        }

        const tokens = await this.getTokens(user);

        const hashedToken = await this.DataEncryption.encrypt(tokens.refreshToken);
        const ttl = this.configService.refreshTokenTtl;
        const expiresAt = Date.now() + ttl;

        validTokens.push({ hash: hashedToken, expiresAt });

        const nextExpiration = Math.min(...validTokens.map(t => t.expiresAt));
        const cacheTtl = Math.max(nextExpiration - Date.now(), 0);
        await this.cacheManager.set(key, validTokens, cacheTtl);

        this.logger.log(`Tokens refreshed for user ${userId}. Total tokens: ${validTokens.length}`);
        return tokens;
    }
}
