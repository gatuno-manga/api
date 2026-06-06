import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { ReadingProgressService } from '@users/application/use-cases/reading-progress.service';
import {
	BulkReadingProgressDto,
	ReadingProgressResponseDto,
	SaveReadingProgressDto,
	SyncReadingProgressDto,
	SyncResponseDto,
} from '@users/infrastructure/http/dto/reading-progress.dto';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { DataEnvelopeInterceptor } from 'src/common/interceptors/data-envelope.interceptor';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';

@Controller('users/me/reading-progress')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(DataEnvelopeInterceptor)
export class ReadingProgressController {
	constructor(private readonly progressService: ReadingProgressService) {}

	/**
	 * Salva o progresso de leitura de um capítulo
	 */
	@Post()
	@Permissions(PermissionsEnum.READING_PROGRESS_MANAGE)
	async saveProgress(
		@CurrentUser() user: CurrentUserDto,
		@Body() dto: SaveReadingProgressDto,
	): Promise<ReadingProgressResponseDto> {
		return this.progressService.saveProgress(user.userId, dto);
	}

	/**
	 * Sincroniza o progresso local com o servidor
	 */
	@Post('sync')
	@Permissions(PermissionsEnum.SYNC_ALL)
	async syncProgress(
		@CurrentUser() user: CurrentUserDto,
		@Body() dto: SyncReadingProgressDto,
	): Promise<SyncResponseDto> {
		return this.progressService.syncProgress(user.userId, dto);
	}

	/**
	 * Obtém todo o progresso de leitura do usuário
	 */
	@Get()
	@Permissions(PermissionsEnum.READING_PROGRESS_MANAGE)
	async getAllProgress(
		@CurrentUser() user: CurrentUserDto,
	): Promise<ReadingProgressResponseDto[]> {
		return this.progressService.getAllProgress(user.userId);
	}

	/**
	 * Obtém o progresso de um capítulo específico
	 */
	@Get('chapter/:chapterId')
	@Permissions(PermissionsEnum.READING_PROGRESS_MANAGE)
	async getProgress(
		@CurrentUser() user: CurrentUserDto,
		@Param('chapterId', ParseUUIDPipe) chapterId: string,
	): Promise<ReadingProgressResponseDto | null> {
		return this.progressService.getProgress(user.userId, chapterId);
	}

	/**
	 * Obtém todo o progresso de um livro
	 */
	@Get('book/:bookId')
	@Permissions(PermissionsEnum.READING_PROGRESS_MANAGE)
	async getBookProgress(
		@CurrentUser() user: CurrentUserDto,
		@Param('bookId', ParseUUIDPipe) bookId: string,
	): Promise<BulkReadingProgressDto> {
		return this.progressService.getBookProgress(user.userId, bookId);
	}

	/**
	 * Remove o progresso de um capítulo
	 */
	@Delete('chapter/:chapterId')
	@Permissions(PermissionsEnum.READING_PROGRESS_MANAGE)
	async deleteProgress(
		@CurrentUser() user: CurrentUserDto,
		@Param('chapterId', ParseUUIDPipe) chapterId: string,
	): Promise<void> {
		return this.progressService.deleteProgress(user.userId, chapterId);
	}

	/**
	 * Remove todo progresso de um livro
	 */
	@Delete('book/:bookId')
	@Permissions(PermissionsEnum.READING_PROGRESS_MANAGE)
	async deleteBookProgress(
		@CurrentUser() user: CurrentUserDto,
		@Param('bookId', ParseUUIDPipe) bookId: string,
	): Promise<void> {
		return this.progressService.deleteBookProgress(user.userId, bookId);
	}
}
