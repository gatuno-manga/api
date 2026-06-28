import { DashboardFilterDto } from '@/dashboard/application/dto/dashboard-filter.dto';
import {
	DashboardRepositoryPort,
	DashboardStats,
} from '@/dashboard/application/ports/dashboard-repository.port';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';

@Injectable()
export class GetDashboardOverviewUseCase {
	constructor(
		@Inject('DashboardRepositoryPort')
		private readonly dashboardRepository: DashboardRepositoryPort,
		@Inject(CACHE_MANAGER)
		private readonly cacheManager: Cache,
		private readonly configService: ConfigService,
	) {}

	async execute(filter?: DashboardFilterDto): Promise<DashboardStats> {
		const sensitiveContent = filter?.sensitiveContent || 'all';
		const cacheKey = `dashboard_overview_stats_${sensitiveContent}`;

		const cachedStats =
			await this.cacheManager.get<DashboardStats>(cacheKey);
		if (cachedStats) {
			return cachedStats;
		}

		const stats = await this.dashboardRepository.getOverviewStats(filter);

		const ttlMinutes = this.configService.get<number>(
			'DASHBOARD_CACHE_TTL_MINUTES',
			15,
		);
		const ttlMs = ttlMinutes * 60 * 1000;

		await this.cacheManager.set(cacheKey, stats, ttlMs);

		return stats;
	}
}
