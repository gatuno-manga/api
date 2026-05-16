import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { AdminSystemManagementService } from '@books/application/services/admin-system-management.service';
import {
	ApiDocsListCronJobs,
	ApiDocsStopCronJob,
	ApiDocsStartCronJob,
	ApiDocsListQueues,
	ApiDocsPauseQueue,
	ApiDocsResumeQueue,
	ApiDocsResetAutoPause,
} from './swagger/admin-system-management.swagger';

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
	@ApiDocsListCronJobs()
	listCronJobs() {
		return this.systemManagementService.listCronJobs();
	}

	@Patch('cron/:name/stop')
	@ApiDocsStopCronJob()
	stopCronJob(@Param('name') name: string) {
		return this.systemManagementService.stopCronJob(name);
	}

	@Patch('cron/:name/start')
	@ApiDocsStartCronJob()
	startCronJob(@Param('name') name: string) {
		return this.systemManagementService.startCronJob(name);
	}

	@Get('queues')
	@ApiDocsListQueues()
	listQueues() {
		return this.systemManagementService.listQueues();
	}

	@Patch('queues/:name/pause')
	@ApiDocsPauseQueue()
	pauseQueue(@Param('name') name: string) {
		return this.systemManagementService.pauseQueue(name);
	}

	@Patch('queues/:name/resume')
	@ApiDocsResumeQueue()
	resumeQueue(@Param('name') name: string) {
		return this.systemManagementService.resumeQueue(name);
	}

	@Patch('queues/:name/reset-autopause')
	@ApiDocsResetAutoPause()
	resetAutoPause(@Param('name') name: string) {
		return this.systemManagementService.resetAutoPauseCounter(name);
	}
}
