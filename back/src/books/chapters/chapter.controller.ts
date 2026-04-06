import { CacheTTL } from '@nestjs/cache-manager';
import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import {
	ApiBody,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { OptionalAuthGuard } from 'src/auth/guard/optional-auth.guard';
import { UserAwareCacheInterceptor } from 'src/common/interceptors/user-aware-cache.interceptor';
import { AuthenticatedApi } from 'src/common/swagger/auth-api.decorators';
import { COMMON_RESPONSES } from 'src/common/swagger/common-responses';
import { ChapterService } from './chapter.service';

@ApiTags('Chapters')
@Controller('chapters')
export class ChapterController {
	constructor(private readonly chapterService: ChapterService) {}

	@Get(':idChapter')
	@Throttle({ long: { limit: 200, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(600)
	@ApiOperation({
		summary: 'Obter capitulo por ID',
		description: 'Retorna conteudo e detalhes do capitulo',
	})
	@ApiParam({
		name: 'idChapter',
		description: 'Identificador unico do capitulo',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Capitulo encontrado' })
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS)
	@UseGuards(OptionalAuthGuard)
	getChapter(
		@Param('idChapter') idChapter: string,
		@CurrentUser() user?: CurrentUserDto,
	) {
		return this.chapterService.getChapter(idChapter, user?.userId);
	}

	@Patch(':idChapter/reset/')
	@AuthenticatedApi()
	@ApiOperation({
		summary: 'Resetar capitulo',
		description: 'Reseta cache e dados do capitulo',
	})
	@ApiParam({
		name: 'idChapter',
		description: 'Identificador unico do capitulo',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Capitulo resetado com sucesso' })
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	resetChapter(@Param('idChapter') idChapter: string) {
		return this.chapterService.resetChapter(idChapter);
	}

	@Patch('/reset')
	@AuthenticatedApi()
	@ApiOperation({
		summary: 'Resetar multiplos capitulos',
		description: 'Reseta cache e dados de varios capitulos',
	})
	@ApiResponse({
		status: 200,
		description: 'Capitulos resetados com sucesso',
	})
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	resetAllChapters(@Body() body: string[]) {
		return this.chapterService.resetAllChapters(body);
	}

	@Get('/:idChapter/read/')
	@Throttle({ medium: { limit: 50, ttl: 60000 } })
	@AuthenticatedApi()
	@ApiOperation({
		summary: 'Marcar capitulo como lido',
		description: 'Marca um capitulo como lido para o usuario atual',
	})
	@ApiParam({
		name: 'idChapter',
		description: 'Identificador unico do capitulo',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Capitulo marcado como lido' })
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS)
	markChapterAsRead(
		@Param('idChapter') idChapter: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.chapterService.markChapterAsRead(idChapter, user.userId);
	}

	@Delete('/:idChapter/read/')
	@Throttle({ medium: { limit: 50, ttl: 60000 } })
	@AuthenticatedApi()
	@ApiOperation({
		summary: 'Marcar capitulo como nao lido',
		description: 'Marca um capitulo como nao lido para o usuario atual',
	})
	@ApiParam({
		name: 'idChapter',
		description: 'Identificador unico do capitulo',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Capitulo marcado como nao lido' })
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.TOO_MANY_REQUESTS)
	markChapterAsUnread(
		@Param('idChapter') idChapter: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.chapterService.markChapterAsUnread(idChapter, user.userId);
	}

	@Post('batch/read')
	@Throttle({ medium: { limit: 20, ttl: 60000 } })
	@AuthenticatedApi()
	@ApiOperation({
		summary: 'Marcar multiplos capitulos como lidos',
		description: 'Marca varios capitulos como lidos para o usuario atual',
	})
	@ApiResponse({ status: 200, description: 'Capitulos marcados como lidos' })
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	markChaptersAsRead(
		@Body() chapterIds: string[],
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.chapterService.markChaptersAsRead(chapterIds, user.userId);
	}

	@Post('batch/unread')
	@Throttle({ medium: { limit: 20, ttl: 60000 } })
	@AuthenticatedApi()
	@ApiOperation({
		summary: 'Marcar multiplos capitulos como nao lidos',
		description:
			'Marca varios capitulos como nao lidos para o usuario atual',
	})
	@ApiResponse({
		status: 200,
		description: 'Capitulos marcados como nao lidos',
	})
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	markChaptersAsUnread(
		@Body() chapterIds: string[],
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.chapterService.markChaptersAsUnread(
			chapterIds,
			user.userId,
		);
	}

	@Get('less-pages/:pages')
	@AuthenticatedApi()
	@ApiOperation({
		summary: 'Listar capitulos com poucas paginas',
		description: 'Lista capitulos com menos paginas que o valor informado',
	})
	@ApiParam({
		name: 'pages',
		description: 'Quantidade maxima de paginas',
		example: 10,
	})
	@ApiResponse({
		status: 200,
		description: 'Capitulos retornados com sucesso',
	})
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	getChaptersWithLessPages(@Param('pages') pages: number) {
		return this.chapterService.listLessPages(pages);
	}

	@Post('batch/data')
	@Throttle({ long: { limit: 100, ttl: 60000 } })
	@ApiOperation({
		summary: 'Obter dados de multiplos capitulos',
		description:
			'Retorna conteudo e detalhes de varios capitulos de uma vez (otimizado para download offline)',
	})
	@ApiBody({ type: [String], description: 'Array de IDs de capitulos' })
	@ApiResponse({
		status: 200,
		description: 'Dados dos capitulos retornados com sucesso',
	})
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@UseGuards(OptionalAuthGuard)
	getChaptersBatch(@Body() chapterIds: string[]) {
		return this.chapterService.getChaptersBatch(chapterIds);
	}
}
