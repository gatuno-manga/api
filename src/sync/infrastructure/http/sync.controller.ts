import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { ProcessSyncUseCase } from '@/sync/application/use-cases/process-sync.use-case';
import { SyncRequestDto } from './dto/sync-request.dto';
import { ApiDocsSync } from './swagger/sync.swagger';

@ApiTags('Sync')
@ApiBearerAuth()
@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
	constructor(private readonly processSyncUseCase: ProcessSyncUseCase) {}

	@Post()
	@ApiDocsSync()
	async sync(
		@CurrentUser() user: CurrentUserDto,
		@Body() dto: SyncRequestDto,
	) {
		return this.processSyncUseCase.execute(user, dto);
	}
}
