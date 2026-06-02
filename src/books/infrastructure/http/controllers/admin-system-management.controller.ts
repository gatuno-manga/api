import { AdminSystemManagementService } from '@books/application/services/admin-system-management.service';
import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import {
	ApiDocsListCronJobs,
	ApiDocsListQueues,
	ApiDocsPauseQueue,
	ApiDocsResetAutoPause,
	ApiDocsResumeQueue,
	ApiDocsStartCronJob,
	ApiDocsStopCronJob,
} from './swagger/admin-system-management.swagger';

@ApiTags('Admin System Management')
@Controller('admin/system')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Roles(RolesEnum.ADMIN)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class AdminSystemManagementController {
	constructor(
		private readonly systemManagementService: AdminSystemManagementService,
	) {}

	@Get('cron')
	@Permissions(PermissionsEnum.SYSTEM_MANAGE)
	@ApiDocsListCronJobs()
	listCronJobs() {
		return this.systemManagementService.listCronJobs();
	}

	@Patch('cron/:name/stop')
	@Permissions(PermissionsEnum.SYSTEM_MANAGE)
	@ApiDocsStopCronJob()
	stopCronJob(@Param('name') name: string) {
		return this.systemManagementService.stopCronJob(name);
	}

	@Patch('cron/:name/start')
	@Permissions(PermissionsEnum.SYSTEM_MANAGE)
	@ApiDocsStartCronJob()
	startCronJob(@Param('name') name: string) {
		return this.systemManagementService.startCronJob(name);
	}

	@Get('queues')
	@Permissions(PermissionsEnum.SYSTEM_MANAGE)
	@ApiDocsListQueues()
	listQueues() {
		return this.systemManagementService.listQueues();
	}

	@Patch('queues/:name/pause')
	@Permissions(PermissionsEnum.SYSTEM_MANAGE)
	@ApiDocsPauseQueue()
	pauseQueue(@Param('name') name: string) {
		return this.systemManagementService.pauseQueue(name);
	}

	@Patch('queues/:name/resume')
	@Permissions(PermissionsEnum.SYSTEM_MANAGE)
	@ApiDocsResumeQueue()
	resumeQueue(@Param('name') name: string) {
		return this.systemManagementService.resumeQueue(name);
	}

	@Patch('queues/:name/reset-autopause')
	@Permissions(PermissionsEnum.SYSTEM_MANAGE)
	@ApiDocsResetAutoPause()
	resetAutoPause(@Param('name') name: string) {
		return this.systemManagementService.resetAutoPauseCounter(name);
	}
}
