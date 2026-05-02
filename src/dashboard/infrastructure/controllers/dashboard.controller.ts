import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../auth/infrastructure/framework/roles.decorator';
import { JwtAuthGuard } from '../../../auth/infrastructure/framework/jwt-auth.guard';
import { RolesEnum } from '../../../users/domain/enums/roles.enum';
import { GetDashboardOverviewUseCase } from '../../application/use-cases/get-dashboard-overview.use-case';
import { DashboardFilterDto } from '../../application/dto/dashboard-filter.dto';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
export class DashboardController {
	constructor(
		private readonly getDashboardOverviewUseCase: GetDashboardOverviewUseCase,
	) {}

	@Get('overview')
	@ApiOperation({ summary: 'Obter visão geral do dashboard' })
	async getOverview(@Query() filter: DashboardFilterDto) {
		return this.getDashboardOverviewUseCase.execute(filter);
	}
}
