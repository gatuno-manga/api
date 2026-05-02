import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import {
	ApiOperation,
	ApiResponse,
	ApiTags,
	ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { AdminSystemManagementService } from '../../application/services/admin-system-management.service';

@ApiTags('Admin System Management')
@Controller('admin/system')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class AdminSystemManagementController {
	constructor(
		private readonly systemManagementService: AdminSystemManagementService,
	) {}

	@Get('cron')
	@ApiOperation({ summary: 'List all registered cron jobs' })
	listCronJobs() {
		return this.systemManagementService.listCronJobs();
	}

	@Patch('cron/:name/stop')
	@ApiOperation({ summary: 'Stop a specific cron job' })
	stopCronJob(@Param('name') name: string) {
		return this.systemManagementService.stopCronJob(name);
	}

	@Patch('cron/:name/start')
	@ApiOperation({ summary: 'Start a specific cron job' })
	startCronJob(@Param('name') name: string) {
		return this.systemManagementService.startCronJob(name);
	}

	@Get('queues')
	@ApiOperation({ summary: 'List all managed queues' })
	listQueues() {
		return this.systemManagementService.listQueues();
	}

	@Patch('queues/:name/pause')
	@ApiOperation({ summary: 'Pause a specific queue' })
	pauseQueue(@Param('name') name: string) {
		return this.systemManagementService.pauseQueue(name);
	}

	@Patch('queues/:name/resume')
	@ApiOperation({ summary: 'Resume a specific queue' })
	resumeQueue(@Param('name') name: string) {
		return this.systemManagementService.resumeQueue(name);
	}

	@Patch('queues/:name/reset-autopause')
	@ApiOperation({
		summary: 'Reset the auto-pause failure counter for a queue',
	})
	resetAutoPause(@Param('name') name: string) {
		return this.systemManagementService.resetAutoPauseCounter(name);
	}
}
