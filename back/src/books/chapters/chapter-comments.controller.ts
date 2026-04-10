import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { OptionalAuthGuard } from 'src/auth/guard/optional-auth.guard';
import { AuthenticatedApi } from 'src/common/swagger/auth-api.decorators';
import { COMMON_RESPONSES } from 'src/common/swagger/common-responses';
import { ChapterCommentsService } from './chapter-comments.service';
import { CreateChapterCommentDto } from './dto/create-chapter-comment.dto';
import { ChapterCommentsPageOptionsDto } from './dto/chapter-comments-page-options.dto';
import { UpdateChapterCommentDto } from './dto/update-chapter-comment.dto';

@ApiTags('Chapter Comments')
@Controller('chapters/:chapterId/comments')
export class ChapterCommentsController {
	constructor(
		private readonly chapterCommentsService: ChapterCommentsService,
	) {}

	@Get()
	@UseGuards(OptionalAuthGuard)
	@Throttle({ medium: { limit: 50, ttl: 60000 } })
	@ApiOperation({
		summary: 'Listar comentarios do capitulo',
		description:
			'Lista comentarios de um capitulo com respostas em arvore e paginacao dos comentarios raiz (page/limit ou cursor)',
	})
	@ApiParam({ name: 'chapterId', description: 'UUID do capitulo' })
	@ApiResponse({
		status: 200,
		description: 'Comentarios listados com sucesso',
	})
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	listChapterComments(
		@Param('chapterId', ParseUUIDPipe) chapterId: string,
		@Query() options: ChapterCommentsPageOptionsDto,
		@CurrentUser() user?: CurrentUserDto,
	) {
		return this.chapterCommentsService.listChapterComments(
			chapterId,
			options,
			user,
		);
	}

	@Post()
	@AuthenticatedApi()
	@Throttle({ medium: { limit: 20, ttl: 60000 } })
	@ApiOperation({
		summary: 'Criar comentario no capitulo',
		description: 'Cria um comentario raiz para o capitulo',
	})
	@ApiParam({ name: 'chapterId', description: 'UUID do capitulo' })
	@ApiResponse({ status: 201, description: 'Comentario criado com sucesso' })
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	createComment(
		@Param('chapterId', ParseUUIDPipe) chapterId: string,
		@Body() dto: CreateChapterCommentDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.chapterCommentsService.createComment(chapterId, dto, user);
	}

	@Post(':parentId/replies')
	@AuthenticatedApi()
	@Throttle({ medium: { limit: 20, ttl: 60000 } })
	@ApiOperation({
		summary: 'Responder comentario',
		description: 'Cria uma resposta para qualquer comentario da discussao',
	})
	@ApiParam({ name: 'chapterId', description: 'UUID do capitulo' })
	@ApiParam({ name: 'parentId', description: 'UUID do comentario pai' })
	@ApiResponse({ status: 201, description: 'Resposta criada com sucesso' })
	@ApiResponse(COMMON_RESPONSES.BAD_REQUEST)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	createReply(
		@Param('chapterId', ParseUUIDPipe) chapterId: string,
		@Param('parentId', ParseUUIDPipe) parentId: string,
		@Body() dto: CreateChapterCommentDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.chapterCommentsService.createReply(
			chapterId,
			parentId,
			dto,
			user,
		);
	}

	@Patch(':commentId')
	@AuthenticatedApi()
	@Throttle({ medium: { limit: 20, ttl: 60000 } })
	@ApiOperation({
		summary: 'Atualizar comentario',
		description: 'Atualiza um comentario do capitulo (autor ou admin)',
	})
	@ApiParam({ name: 'chapterId', description: 'UUID do capitulo' })
	@ApiParam({ name: 'commentId', description: 'UUID do comentario' })
	@ApiResponse({
		status: 200,
		description: 'Comentario atualizado com sucesso',
	})
	@ApiResponse({
		status: 400,
		description: 'Comentarios removidos nao podem ser editados',
	})
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse({ status: 403, description: 'Proibido' })
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	updateComment(
		@Param('chapterId', ParseUUIDPipe) chapterId: string,
		@Param('commentId', ParseUUIDPipe) commentId: string,
		@Body() dto: UpdateChapterCommentDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.chapterCommentsService.updateComment(
			chapterId,
			commentId,
			dto,
			user,
		);
	}

	@Delete(':commentId')
	@AuthenticatedApi()
	@Throttle({ medium: { limit: 20, ttl: 60000 } })
	@ApiOperation({
		summary: 'Remover comentario',
		description:
			'Remove logicamente um comentario mantendo a estrutura de respostas',
	})
	@ApiParam({ name: 'chapterId', description: 'UUID do capitulo' })
	@ApiParam({ name: 'commentId', description: 'UUID do comentario' })
	@ApiResponse({
		status: 200,
		description: 'Comentario removido com sucesso',
	})
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse({ status: 403, description: 'Proibido' })
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	deleteComment(
		@Param('chapterId', ParseUUIDPipe) chapterId: string,
		@Param('commentId', ParseUUIDPipe) commentId: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.chapterCommentsService.deleteComment(
			chapterId,
			commentId,
			user,
		);
	}
}
