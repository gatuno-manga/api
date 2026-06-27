import { Injectable } from '@nestjs/common';
import { IWebsiteCache } from '@websites/application/ports/website-cache.interface';
import { Website } from '@websites/domain/entities/website';
import { RedisService } from '../../../../infrastructure/redis/redis.service';

@Injectable()
export class RedisWebsiteCacheAdapter implements IWebsiteCache {
	constructor(private readonly redisService: RedisService) {}

	async set(website: Website): Promise<void> {
		await this.redisService
			.getClient()
			.set(`website:config:${website.id}`, JSON.stringify(website));
	}

	async delete(id: string): Promise<void> {
		await this.redisService.getClient().del(`website:config:${id}`);
	}
}
