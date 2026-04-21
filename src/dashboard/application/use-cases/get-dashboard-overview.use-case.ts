import { Inject, Injectable } from '@nestjs/common';
import {
	DashboardRepositoryPort,
	DashboardStats,
} from '../ports/dashboard-repository.port';

@Injectable()
export class GetDashboardOverviewUseCase {
	constructor(
		@Inject('DashboardRepositoryPort')
		private readonly dashboardRepository: DashboardRepositoryPort,
	) {}

	async execute(): Promise<DashboardStats> {
		return this.dashboardRepository.getOverviewStats();
	}
}
