import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
	Inject,
	Injectable,
	Logger,
	Optional,
	UnauthorizedException,
} from '@nestjs/common';
import { Cache } from 'cache-manager';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { AppConfigService } from 'src/app-config/app-config.service';
import { REDIS_CLIENT } from 'src/redis/redis.constants';
import { StoredTokenDto } from '../dto/stored-token.dto';

@Injectable()
export class TokenStoreService {
	private readonly logger = new Logger(TokenStoreService.name);
	private readonly localLocks = new Set<string>();
	private readonly refreshLockTtlMs = 10_000;

	constructor(
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		private readonly configService: AppConfigService,
		@Optional()
		@Inject(REDIS_CLIENT)
		private readonly redisClient?: Redis,
	) {}

	private getRedisKey(userId: string): string {
		return `user-tokens:${userId}`;
	}

	private getRefreshLockKey(userId: string): string {
		return `refresh-lock:${userId}`;
	}

	private async acquireRefreshLock(
		userId: string,
		lockId: string,
	): Promise<boolean> {
		const key = this.getRefreshLockKey(userId);

		if (this.redisClient) {
			const result = await this.redisClient.set(
				key,
				lockId,
				'PX',
				this.refreshLockTtlMs,
				'NX',
			);
			return result === 'OK';
		}

		if (this.localLocks.has(key)) {
			return false;
		}

		this.localLocks.add(key);
		return true;
	}

	private async releaseRefreshLock(
		userId: string,
		lockId: string,
	): Promise<void> {
		const key = this.getRefreshLockKey(userId);

		if (this.redisClient) {
			await this.redisClient.eval(
				`if redis.call('get', KEYS[1]) == ARGV[1] then
					return redis.call('del', KEYS[1])
				else
					return 0
				end`,
				1,
				key,
				lockId,
			);
			return;
		}

		this.localLocks.delete(key);
	}

	async runWithRefreshLock<T>(
		userId: string,
		operation: () => Promise<T>,
	): Promise<T> {
		const lockId = randomUUID();
		const acquired = await this.acquireRefreshLock(userId, lockId);

		if (!acquired) {
			throw new UnauthorizedException('Refresh already in progress');
		}

		try {
			return await operation();
		} finally {
			await this.releaseRefreshLock(userId, lockId);
		}
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
		tokenData: Pick<
			StoredTokenDto,
			'hash' | 'jti' | 'sessionId' | 'familyId' | 'parentJti'
		>,
		existingTokens?: StoredTokenDto[],
	): Promise<void> {
		const tokens = existingTokens ?? (await this.getValidTokens(userId));
		const ttl = this.configService.refreshTokenTtl;
		const expiresAt = Date.now() + ttl;

		tokens.push({
			hash: tokenData.hash,
			jti: tokenData.jti,
			sessionId: tokenData.sessionId,
			familyId: tokenData.familyId,
			parentJti: tokenData.parentJti,
			expiresAt,
		});

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

	async revokeTokenFamily(
		userId: string,
		familyId: string,
		existingTokens?: StoredTokenDto[],
	): Promise<number> {
		const tokens = existingTokens ?? (await this.getValidTokens(userId));
		const tokensToKeep = tokens.filter(
			(token) => token.familyId !== familyId,
		);
		const revokedCount = tokens.length - tokensToKeep.length;

		if (revokedCount === 0) {
			return 0;
		}

		await this.saveTokens(userId, tokensToKeep);
		this.logger.warn(
			`Revoked ${revokedCount} token(s) from family ${familyId} for user ${userId}`,
		);

		return revokedCount;
	}

	async removeTokenByJti(userId: string, jti: string): Promise<number> {
		const tokens = await this.getValidTokens(userId);
		const filtered = tokens.filter((token) => token.jti !== jti);
		if (filtered.length === tokens.length) {
			return 0;
		}

		await this.saveTokens(userId, filtered);
		return tokens.length - filtered.length;
	}

	async removeTokensByJtis(userId: string, jtis: string[]): Promise<number> {
		if (jtis.length === 0) {
			return 0;
		}

		const tokenSet = new Set(jtis);
		const tokens = await this.getValidTokens(userId);
		const filtered = tokens.filter((token) => !tokenSet.has(token.jti));
		if (filtered.length === tokens.length) {
			return 0;
		}

		await this.saveTokens(userId, filtered);
		return tokens.length - filtered.length;
	}

	async removeAllTokens(userId: string): Promise<void> {
		const key = this.getRedisKey(userId);
		await this.cacheManager.del(key);
	}
}
