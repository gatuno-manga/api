import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { RolesEnum } from '../users/enum/roles.enum';

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
