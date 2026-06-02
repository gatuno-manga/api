import { DashboardFilterDto } from '@/dashboard/application/dto/dashboard-filter.dto';
import { GetDashboardOverviewUseCase } from '@/dashboard/application/use-cases/get-dashboard-overview.use-case';
import { JwtAuthGuard } from '@auth/infrastructure/framework/jwt-auth.guard';
import { Roles } from '@auth/infrastructure/framework/roles.decorator';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionsEnum } from '@users/domain/enums/permissions.enum';
import { RolesEnum } from '@users/domain/enums/roles.enum';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { ApiDocsGetOverview } from './swagger/dashboard.swagger';

import { AdminApi } from 'src/common/swagger/auth-api.decorators';

@ApiTags('Dashboard')
@Controller('dashboard')
@AdminApi()
export class DashboardController {
	constructor(
		private readonly getDashboardOverviewUseCase: GetDashboardOverviewUseCase,
	) {}

	@Get('overview')
	@Permissions(PermissionsEnum.INTERNAL_PANEL_ACCESS)
	@ApiDocsGetOverview()
	async getOverview(@Query() filter: DashboardFilterDto) {
		return this.getDashboardOverviewUseCase.execute(filter);
	}
}
