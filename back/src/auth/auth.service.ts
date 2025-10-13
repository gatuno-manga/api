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

        const storedTokens: string[] = (await this.cacheManager.get(key)) || [];
        storedTokens.push(hashedToken);
        await this.cacheManager.set(key, storedTokens, ttl);
        this.logger.log(`Stored refresh token for user ${userId}. Total tokens: ${storedTokens.length}`);
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

        // Recarregar usuário com relações completas
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
        const storedTokens: string[] = (await this.cacheManager.get(key)) || [];

        if (storedTokens.length === 0) {
            this.logger.warn('No tokens found in cache for user', { userId });
            throw new UnauthorizedException('No active sessions found');
        }

        let index = -1;
        for (let i = 0; i < storedTokens.length; i++) {
            if (await this.DataEncryption.compare(storedTokens[i], refreshToken)) {
                index = i;
                break;
            }
        }

        if (index === -1) {
            this.logger.error('Token not found in cache', { userId });
            throw new UnauthorizedException('Invalid token');
        }

        storedTokens.splice(index, 1);

        if (storedTokens.length === 0) {
            await this.cacheManager.del(key);
            this.logger.log(`All tokens removed for user ${userId}`);
        } else {
            await this.cacheManager.set(key, storedTokens, this.configService.refreshTokenTtl);
            this.logger.log(`Token removed for user ${userId}. Remaining tokens: ${storedTokens.length}`);
        }

        return { message: 'Logged out successfully' };
    }

    async logoutAll(userId: string) {
        const key = this.getRedisKey(userId);
        const storedTokens: string[] = (await this.cacheManager.get(key)) || [];

        if (storedTokens.length === 0) {
            this.logger.warn('No active sessions found for user', { userId });
            throw new UnauthorizedException('No active sessions found');
        }

        await this.cacheManager.del(key);
        this.logger.log(`All sessions (${storedTokens.length}) logged out for user ${userId}`);
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
        const storedHashes: string[] = (await this.cacheManager.get(key)) || [];

        if (storedHashes.length === 0) {
            this.logger.warn('No valid session found for user', { userId });
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
            this.logger.error('Invalid refresh token for user', { userId });
            throw new UnauthorizedException('Invalid refresh token');
        }

        // Remover o token antigo
        if (indexToRemove > -1) {
            storedHashes.splice(indexToRemove, 1);
        }

        // Buscar usuário com roles
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['roles'],
        });

        if (!user) {
            this.logger.error('User not found during token refresh', { userId });
            throw new UnauthorizedException('User not found');
        }

        // Gerar novos tokens
        const tokens = await this.getTokens(user);

        // Armazenar apenas o novo token (storeRefreshToken já adiciona ao array)
        await this.storeRefreshToken(user.id, tokens.refreshToken);

        this.logger.log(`Tokens refreshed for user ${userId}`);
        return tokens;
    }
}
