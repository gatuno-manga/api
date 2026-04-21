import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../auth/infrastructure/framework/roles.decorator';
import { JwtAuthGuard } from '../../../auth/infrastructure/framework/jwt-auth.guard';
import { RolesEnum } from '../../../users/enum/roles.enum';
import { GetDashboardOverviewUseCase } from '../../application/use-cases/get-dashboard-overview.use-case';

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
	async getOverview() {
		return this.getDashboardOverviewUseCase.execute();
	}
}
