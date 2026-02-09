import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorator/roles.decorator';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesEnum } from '../users/enum/roles.enum';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
export class DashboardController {
	constructor(private readonly dashboardService: DashboardService) {}

	@Get('overview')
	@ApiOperation({ summary: 'Obter visão geral do dashboard' })
	async getOverview() {
		return this.dashboardService.getOverview();
	}
}
