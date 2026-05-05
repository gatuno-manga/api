import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@auth/infrastructure/framework/roles.decorator';
import { JwtAuthGuard } from '@auth/infrastructure/framework/jwt-auth.guard';
import { RolesEnum } from '@users/domain/enums/roles.enum';
import { GetDashboardOverviewUseCase } from '@/dashboard/application/use-cases/get-dashboard-overview.use-case';
import { DashboardFilterDto } from '@/dashboard/application/dto/dashboard-filter.dto';
import { ApiDocsGetOverview } from './swagger/dashboard.swagger';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
export class DashboardController {
	constructor(
		private readonly getDashboardOverviewUseCase: GetDashboardOverviewUseCase,
	) {}

	@Get('overview')
	@ApiDocsGetOverview()
	async getOverview(@Query() filter: DashboardFilterDto) {
		return this.getDashboardOverviewUseCase.execute(filter);
	}
}
