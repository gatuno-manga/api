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
		const validTokens = tokens.filter((t) => t.expiresAt > Date.now());

		if (validTokens.length === 0) {
			await this.cacheManager.del(key);
			return;
		}

		const latestExpiration = Math.max(
			...validTokens.map((t) => t.expiresAt),
		);
		const cacheTtl = Math.max(latestExpiration - Date.now(), 0);

		await this.cacheManager.set(key, validTokens, cacheTtl);
	}

	async addToken(
		userId: string,
		hashedToken: string,
		existingTokens?: StoredTokenDto[],
	): Promise<void> {
		const tokens = existingTokens ?? (await this.getValidTokens(userId));
		const ttl = this.configService.refreshTokenTtl;
		const expiresAt = Date.now() + ttl;

		tokens.push({ hash: hashedToken, expiresAt });

		const maxSessions = this.configService.maxSessionsPerUser;
		if (maxSessions > 0 && tokens.length > maxSessions) {
			tokens.sort((a, b) => a.expiresAt - b.expiresAt);
			const removed = tokens.splice(0, tokens.length - maxSessions);
			this.logger.warn(
				`Session limit (${maxSessions}) reached for user ${userId}. Evicted ${removed.length} oldest session(s).`,
			);
		}

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
