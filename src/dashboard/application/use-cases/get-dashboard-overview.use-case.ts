import { Inject, Injectable } from '@nestjs/common';
import {
	DashboardRepositoryPort,
	DashboardStats,
} from '@/dashboard/application/ports/dashboard-repository.port';
import { DashboardFilterDto } from '@/dashboard/application/dto/dashboard-filter.dto';

@Injectable()
export class GetDashboardOverviewUseCase {
	constructor(
		@Inject('DashboardRepositoryPort')
		private readonly dashboardRepository: DashboardRepositoryPort,
	) {}

	async execute(filter?: DashboardFilterDto): Promise<DashboardStats> {
		return this.dashboardRepository.getOverviewStats(filter);
	}
}
