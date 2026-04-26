import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { GqlCurrentUser } from 'src/auth/infrastructure/framework/gql-current-user.decorator';
import { GqlJwtAuthGuard } from 'src/auth/infrastructure/framework/gql-jwt-auth.guard';
import { ProcessSyncUseCase } from '../../../application/use-cases/process-sync.use-case';
import { SyncInput } from '../models/sync.input';
import { SyncResultModel, ReadingProgressModel } from '../models/sync.model';
import { ISyncResult } from '../../../application/types/sync-result.interface';

@Resolver()
@UseGuards(GqlJwtAuthGuard)
export class SyncResolver {
	constructor(private readonly processSyncUseCase: ProcessSyncUseCase) {}

	@Mutation(() => SyncResultModel, { name: 'sync' })
	async sync(
		@GqlCurrentUser() user: CurrentUserDto,
		@Args('input') input: SyncInput,
	): Promise<SyncResultModel> {
		// Mapeia o Input do GraphQL para o DTO que o UseCase já entende
		const syncResult: ISyncResult = await this.processSyncUseCase.execute(
			user,
			{
				lastSyncAt: input.lastSyncAt?.toISOString(),
				readingProgress: input.readingProgress?.map((p) => ({
					bookId: p.bookId,
					chapterId: p.chapterId,
					pageIndex: p.pageIndex,
					updatedAt: p.updatedAt,
				})),
				savedPages: input.savedPages?.map((p) => ({
					bookId: p.bookId,
					chapterId: p.chapterId,
					pageId: p.pageIndex,
				})),
				comments: input.comments?.map((c) => ({
					chapterId: c.chapterId,
					parentId: c.parentId,
					content: c.content,
					isPublic: c.isPublic,
				})),
			},
		);

		// Formata o retorno para o modelo GraphQL
		const syncedProgress: ReadingProgressModel[] =
			syncResult.readingProgress.synced.map((p) => ({
				bookId: p.bookId,
				chapterId: p.chapterId,
				pageIndex: p.pageIndex,
				updatedAt: p.updatedAt,
			}));

		const savedPagesIds: string[] = syncResult.savedPages.map((p) => p.id);

		const syncedComments = syncResult.comments.map((c) => ({
			id: c.id,
			userId: c.userId,
			userName: c.userName,
			profileImageUrl: c.profileImageUrl,
			content: c.content,
			isPublic: c.isPublic,
			isDeleted: c.isDeleted,
			createdAt: c.createdAt,
			updatedAt: c.updatedAt,
			replies: [], // Simplificado para o retorno da mutation
		}));

		return {
			readingProgress: syncedProgress,
			savedPagesIds,
			comments: syncedComments,
			syncedAt: syncResult.syncedAt,
		};
	}
}
