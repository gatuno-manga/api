import { SyncRegistry } from '@/sync/application/services/sync.registry';
import { ProcessSyncUseCase } from '@/sync/application/use-cases/process-sync.use-case';
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import { PullSyncRequestDto } from './dto/pull-sync-request.dto';
import { PushSyncRequestDto } from './dto/push-sync-request.dto';
import { SyncRequestDto } from './dto/sync-request.dto';
import { ApiDocsSync } from './swagger/sync.swagger';

@ApiTags('Sync')
@ApiBearerAuth()
@Controller('sync')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SyncController {
	constructor(
		private readonly processSyncUseCase: ProcessSyncUseCase,
		private readonly syncRegistry: SyncRegistry,
	) {}

	@Post()
	@Permissions(PermissionsEnum.SYNC_ALL)
	@ApiDocsSync()
	async sync(
		@CurrentUser() user: CurrentUserDto,
		@Body() dto: SyncRequestDto,
	) {
		return this.processSyncUseCase.execute(user, dto);
	}

	@Get('pull')
	@Permissions(PermissionsEnum.SYNC_ALL)
	@ApiOperation({ summary: 'Pull data for synchronization' })
	async pull(
		@CurrentUser() user: CurrentUserDto,
		@Query() query: PullSyncRequestDto,
	) {
		const lastSyncAt = query.lastSyncAt
			? new Date(query.lastSyncAt)
			: undefined;
		const providers = this.syncRegistry.getAllProviders();

		const data: Record<string, unknown> = {};
		for (const provider of providers) {
			const featureName = provider.getFeatureName();
			data[featureName] = await provider.pull(user, lastSyncAt);
		}

		return {
			syncedAt: new Date(),
			data,
		};
	}

	@Post('push')
	@Permissions(PermissionsEnum.SYNC_ALL)
	@ApiOperation({ summary: 'Push data for synchronization' })
	async push(
		@CurrentUser() user: CurrentUserDto,
		@Body() dto: PushSyncRequestDto,
	) {
		const providers = this.syncRegistry.getAllProviders();

		for (const provider of providers) {
			const featureName = provider.getFeatureName();
			const payload = (dto as Record<string, unknown[]>)[featureName];
			if (payload && Array.isArray(payload)) {
				await provider.push(user, payload);
			}
		}

		return { success: true, syncedAt: new Date() };
	}
}
