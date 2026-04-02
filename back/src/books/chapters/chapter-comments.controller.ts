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
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { ChapterCommentsService } from './chapter-comments.service';
import { CreateChapterCommentDto } from './dto/create-chapter-comment.dto';
import { ChapterCommentsPageOptionsDto } from './dto/chapter-comments-page-options.dto';
import { UpdateChapterCommentDto } from './dto/update-chapter-comment.dto';

@ApiTags('Chapter Comments')
@Controller('chapters/:chapterId/comments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ChapterCommentsController {
	constructor(
		private readonly chapterCommentsService: ChapterCommentsService,
	) {}

	@Get()
	@Throttle({ medium: { limit: 50, ttl: 60000 } })
	@ApiOperation({
		summary: 'List chapter comments',
		description:
			'List comments for a chapter with threaded replies and root pagination',
	})
	@ApiParam({ name: 'chapterId', description: 'Chapter UUID' })
	@ApiResponse({ status: 200, description: 'Comments listed successfully' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({ status: 404, description: 'Chapter not found' })
	listChapterComments(
		@Param('chapterId', ParseUUIDPipe) chapterId: string,
		@Query() options: ChapterCommentsPageOptionsDto,
	) {
		return this.chapterCommentsService.listChapterComments(
			chapterId,
			options,
		);
	}

	@Post()
	@Throttle({ medium: { limit: 20, ttl: 60000 } })
	@ApiOperation({
		summary: 'Create chapter comment',
		description: 'Create a root comment for a chapter',
	})
	@ApiParam({ name: 'chapterId', description: 'Chapter UUID' })
	@ApiResponse({ status: 201, description: 'Comment created successfully' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({ status: 404, description: 'Chapter not found' })
	createComment(
		@Param('chapterId', ParseUUIDPipe) chapterId: string,
		@Body() dto: CreateChapterCommentDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.chapterCommentsService.createComment(chapterId, dto, user);
	}

	@Post(':parentId/replies')
	@Throttle({ medium: { limit: 20, ttl: 60000 } })
	@ApiOperation({
		summary: 'Reply to comment',
		description: 'Create a reply to any comment in the chapter thread',
	})
	@ApiParam({ name: 'chapterId', description: 'Chapter UUID' })
	@ApiParam({ name: 'parentId', description: 'Parent comment UUID' })
	@ApiResponse({ status: 201, description: 'Reply created successfully' })
	@ApiResponse({ status: 400, description: 'Invalid parent comment state' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({ status: 404, description: 'Chapter or parent not found' })
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
	@Throttle({ medium: { limit: 20, ttl: 60000 } })
	@ApiOperation({
		summary: 'Update comment',
		description: 'Update a chapter comment (owner or admin)',
	})
	@ApiParam({ name: 'chapterId', description: 'Chapter UUID' })
	@ApiParam({ name: 'commentId', description: 'Comment UUID' })
	@ApiResponse({ status: 200, description: 'Comment updated successfully' })
	@ApiResponse({
		status: 400,
		description: 'Deleted comments cannot be edited',
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({ status: 403, description: 'Forbidden' })
	@ApiResponse({ status: 404, description: 'Comment not found' })
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
	@Throttle({ medium: { limit: 20, ttl: 60000 } })
	@ApiOperation({
		summary: 'Delete comment',
		description:
			'Soft delete a chapter comment while preserving reply thread structure',
	})
	@ApiParam({ name: 'chapterId', description: 'Chapter UUID' })
	@ApiParam({ name: 'commentId', description: 'Comment UUID' })
	@ApiResponse({ status: 200, description: 'Comment deleted successfully' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({ status: 403, description: 'Forbidden' })
	@ApiResponse({ status: 404, description: 'Comment not found' })
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
