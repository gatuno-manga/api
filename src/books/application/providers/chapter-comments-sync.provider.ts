import { CurrentUserDto } from '@/auth/application/dto/current-user.dto';
import { SyncRegistry } from '@/sync/application/services/sync.registry';
import { SyncFeature } from '@/sync/application/types/sync-feature.enum';
import { ISyncProvider } from '@/sync/application/types/sync-provider.interface';
import { SyncCommentDto } from '@/sync/infrastructure/http/dto/sync-request.dto';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChapterCommentsService } from '../services/chapter-comments.service';

@Injectable()
export class ChapterCommentsSyncProvider
	implements ISyncProvider<SyncCommentDto>, OnModuleInit
{
	private readonly logger = new Logger(ChapterCommentsSyncProvider.name);

	constructor(
		private readonly syncRegistry: SyncRegistry,
		private readonly chapterCommentsService: ChapterCommentsService,
	) {}

	onModuleInit() {
		this.syncRegistry.register(this);
	}

	getFeatureName(): SyncFeature {
		return SyncFeature.COMMENTS;
	}

	async pull(
		user: CurrentUserDto,
		lastSyncAt?: Date,
	): Promise<SyncCommentDto[]> {
		const comments = await this.chapterCommentsService.getCommentsForSync(
			UserId.create(user.userId),
			lastSyncAt,
		);

		return comments.map((c) => ({
			id: c.id,
			chapterId: c.chapter.id,
			parentId: c.parent?.id,
			content: c.content,
			isPublic: c.isPublic,
			createdAt: c.createdAt,
			updatedAt: c.updatedAt,
			deletedAt: c.deletedAt?.toISOString() ?? undefined,
		}));
	}

	async push(user: CurrentUserDto, data: SyncCommentDto[]): Promise<void> {
		for (const comment of data) {
			try {
				if (comment.deletedAt && comment.id) {
					await this.chapterCommentsService.deleteComment(
						comment.chapterId,
						comment.id,
						user,
					);
					continue;
				}

				if (comment.parentId) {
					await this.chapterCommentsService.createReply(
						comment.chapterId,
						comment.parentId,
						{
							content: comment.content,
							isPublic: comment.isPublic,
						},
						user,
					);
				} else {
					await this.chapterCommentsService.createComment(
						comment.chapterId,
						{
							content: comment.content,
							isPublic: comment.isPublic,
						},
						user,
					);
				}
			} catch (error) {
				this.logger.error(
					`Error syncing comment: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	}
}
