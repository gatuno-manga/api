import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { ProcessSyncUseCase } from '../../application/use-cases/process-sync.use-case';
import { SyncRequestDto } from './dto/sync-request.dto';

@ApiTags('Sync')
@ApiBearerAuth()
@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
	constructor(private readonly processSyncUseCase: ProcessSyncUseCase) {}

	@Post()
	@ApiOperation({ summary: 'Sincronização unificada offline-first' })
	async sync(
		@CurrentUser() user: CurrentUserDto,
		@Body() dto: SyncRequestDto,
	) {
		return this.processSyncUseCase.execute(user, dto);
	}
}
