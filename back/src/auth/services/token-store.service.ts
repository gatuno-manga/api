import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { AppConfigService } from 'src/app-config/app-config.service';
import { StoredTokenDto } from '../dto/stored-token.dto';

@Injectable()
export class TokenStoreService {
	private readonly logger = new Logger(TokenStoreService.name);

	constructor(
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		private readonly configService: AppConfigService,
	) {}

	private getRedisKey(userId: string): string {
		return `user-tokens:${userId}`;
	}

	async getValidTokens(userId: string): Promise<StoredTokenDto[]> {
		const key = this.getRedisKey(userId);
		const storedTokens: StoredTokenDto[] =
			(await this.cacheManager.get(key)) || [];
		
		return storedTokens.filter((t) => t.expiresAt > Date.now());
	}

	async saveTokens(userId: string, tokens: StoredTokenDto[]): Promise<void> {
		const key = this.getRedisKey(userId);
		
		if (tokens.length === 0) {
			await this.cacheManager.del(key);
			return;
		}

		const nextExpiration = Math.min(...tokens.map((t) => t.expiresAt));
		const cacheTtl = Math.max(nextExpiration - Date.now(), 0);

		await this.cacheManager.set(key, tokens, cacheTtl);
	}

	async addToken(userId: string, hashedToken: string): Promise<void> {
		const tokens = await this.getValidTokens(userId);
		const ttl = this.configService.refreshTokenTtl;
		const expiresAt = Date.now() + ttl;

		tokens.push({ hash: hashedToken, expiresAt });
		await this.saveTokens(userId, tokens);
		
		this.logger.log(
			`Stored refresh token for user ${userId}. Total tokens: ${tokens.length}`,
		);
	}

	async removeAllTokens(userId: string): Promise<void> {
		const key = this.getRedisKey(userId);
		await this.cacheManager.del(key);
	}
}
