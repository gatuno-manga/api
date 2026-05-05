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
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { OptionalAuthGuard } from 'src/auth/infrastructure/framework/optional-auth.guard';
import { AuthenticatedApi } from 'src/common/swagger/auth-api.decorators';
import { ChapterCommentsService } from '@books/application/services/chapter-comments.service';
import { CreateChapterCommentDto } from '@books/application/dto/create-chapter-comment.dto';
import { ChapterCommentsPageOptionsDto } from '@books/application/dto/chapter-comments-page-options.dto';
import { UpdateChapterCommentDto } from '@books/application/dto/update-chapter-comment.dto';
import {
	ApiDocsListChapterComments,
	ApiDocsCreateComment,
	ApiDocsCreateReply,
	ApiDocsUpdateComment,
	ApiDocsDeleteComment,
} from './swagger/chapter-comments.swagger';

@ApiTags('Chapter Comments')
@Controller('chapters/:chapterId/comments')
export class ChapterCommentsController {
	constructor(
		private readonly chapterCommentsService: ChapterCommentsService,
	) {}

	@Get()
	@UseGuards(OptionalAuthGuard)
	@Throttle({ medium: { limit: 50, ttl: 60000 } })
	@ApiDocsListChapterComments()
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
	@ApiDocsCreateComment()
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
	@ApiDocsCreateReply()
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
	@ApiDocsUpdateComment()
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
	@ApiDocsDeleteComment()
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
