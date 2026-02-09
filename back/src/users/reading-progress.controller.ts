import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	UseGuards,
} from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import {
	BulkReadingProgressDto,
	ReadingProgressResponseDto,
	SaveReadingProgressDto,
	SyncReadingProgressDto,
	SyncResponseDto,
} from './dto/reading-progress.dto';
import { ReadingProgressService } from './reading-progress.service';

@Controller('reading-progress')
@UseGuards(JwtAuthGuard)
export class ReadingProgressController {
	constructor(private readonly progressService: ReadingProgressService) {}

	/**
	 * Salva o progresso de leitura de um capítulo
	 */
	@Post()
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
	async getAllProgress(
		@CurrentUser() user: CurrentUserDto,
	): Promise<ReadingProgressResponseDto[]> {
		return this.progressService.getAllProgress(user.userId);
	}

	/**
	 * Obtém o progresso de um capítulo específico
	 */
	@Get('chapter/:chapterId')
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
	async deleteBookProgress(
		@CurrentUser() user: CurrentUserDto,
		@Param('bookId', ParseUUIDPipe) bookId: string,
	): Promise<void> {
		return this.progressService.deleteBookProgress(user.userId, bookId);
	}
}
