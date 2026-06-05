import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Role } from 'src/users/infrastructure/database/entities/role.entity';
import { User } from 'src/users/infrastructure/database/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UserPermissionsService {
	private readonly logger = new Logger(UserPermissionsService.name);
	private readonly CACHE_TTL = 3600000; // 1 hour

	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(Role)
		private readonly roleRepository: Repository<Role>,
		@Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
	) {}

	private getCacheKey(userId: string): string {
		return `user-permissions:${userId}`;
	}

	private getGuestCacheKey(): string {
		return 'role-permissions:guest';
	}

	async getPermissions(userId: string): Promise<string[]> {
		const cacheKey = this.getCacheKey(userId);
		const cachedPermissions =
			await this.cacheManager.get<string[]>(cacheKey);

		if (cachedPermissions) {
			return cachedPermissions;
		}

		const permissions = await this.resolvePermissionsFromDb(userId);
		await this.cacheManager.set(cacheKey, permissions, this.CACHE_TTL);

		return permissions;
	}

	private async resolvePermissionsFromDb(userId: string): Promise<string[]> {
		const user = await this.userRepository.findOne({
			where: { id: userId },
			relations: ['roles', 'roles.permissions'],
		});

		if (!user || !user.roles) {
			return [];
		}

		const permissionsSet = new Set<string>();

		for (const role of user.roles) {
			if (role.permissions) {
				for (const permission of role.permissions) {
					permissionsSet.add(permission.name);
				}
			}
		}

		return Array.from(permissionsSet);
	}

	async getGuestPermissions(): Promise<string[]> {
		const cacheKey = this.getGuestCacheKey();
		const cachedPermissions =
			await this.cacheManager.get<string[]>(cacheKey);

		if (cachedPermissions) {
			return cachedPermissions;
		}

		const guestRole = await this.roleRepository.findOne({
			where: { name: 'guest' },
			relations: ['permissions'],
		});

		const permissions = guestRole?.permissions?.map((p) => p.name) || [];
		await this.cacheManager.set(cacheKey, permissions, this.CACHE_TTL);

		return permissions;
	}

	async invalidateCache(userId: string): Promise<void> {
		const cacheKey = this.getCacheKey(userId);
		await this.cacheManager.del(cacheKey);
		this.logger.debug(`Invalidated permissions cache for user ${userId}`);
	}

	async invalidateAllCache(): Promise<void> {
		//  a production environment with many users, we might want a more efficient way
		// For now, we can rely on TTL or implement a versioning strategy for permissions
		// Or if using Redis directly, use SCAN/DEL
		this.logger.debug(
			'All permissions cache invalidated (triggered by global change)',
		);
		await this.cacheManager.del(this.getGuestCacheKey());
	}
}
