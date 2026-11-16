import { BookDataLoaderService } from '@books/application/services/book-dataloader.service';
import { ChapterService } from '@books/application/services/chapter.service';
import {
	ChapterModel,
	ChapterReadResultModel,
} from '@books/infrastructure/graphql/models/chapter.model';
import { UseGuards } from '@nestjs/common';
import {
	Args,
	ID,
	Mutation,
	Parent,
	ResolveField,
	Resolver,
} from '@nestjs/graphql';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { GqlCurrentUser } from 'src/auth/infrastructure/framework/gql-current-user.decorator';
import { GqlJwtAuthGuard } from 'src/auth/infrastructure/framework/gql-jwt-auth.guard';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';

interface BatchReadResult {
	chapterId: string;
	success: boolean;
	error?: string;
}

/**
 * Per-user read state of a chapter. Fetching a chapter never marks it read;
 * clients mark it explicitly with these mutations (or REST /chapters/:id/read).
 */
@Resolver(() => ChapterModel)
export class ChapterResolver {
	constructor(
		private readonly chapterService: ChapterService,
		private readonly dataLoaderService: BookDataLoaderService,
	) {}

	// Resolved per request, outside the cached parent query, so it is never stale.
	@ResolveField(() => Boolean, { name: 'read', nullable: true })
	async resolveRead(
		@Parent() chapter: ChapterModel,
		@GqlCurrentUser() user?: CurrentUserDto,
	): Promise<boolean | null> {
		if (!user?.userId) return null;
		return this.dataLoaderService
			.chapterReadLoader(user.userId)
			.load(chapter.id);
	}

	@Mutation(() => ChapterModel, { name: 'markChapterRead' })
	@UseGuards(GqlJwtAuthGuard, PermissionsGuard)
	@Permissions(PermissionsEnum.READING_PROGRESS_MANAGE)
	async markChapterRead(
		@Args('chapterId', { type: () => ID }) chapterId: string,
		@GqlCurrentUser() user: CurrentUserDto,
	) {
		await this.chapterService.markChapterAsRead(chapterId, user.userId);
		return this.chapterService.getChapter(chapterId);
	}

	@Mutation(() => ChapterModel, { name: 'markChapterUnread' })
	@UseGuards(GqlJwtAuthGuard, PermissionsGuard)
	@Permissions(PermissionsEnum.READING_PROGRESS_MANAGE)
	async markChapterUnread(
		@Args('chapterId', { type: () => ID }) chapterId: string,
		@GqlCurrentUser() user: CurrentUserDto,
	) {
		await this.chapterService.markChapterAsUnread(chapterId, user.userId);
		return this.chapterService.getChapter(chapterId);
	}

	@Mutation(() => [ChapterReadResultModel], { name: 'markChaptersRead' })
	@UseGuards(GqlJwtAuthGuard, PermissionsGuard)
	@Permissions(PermissionsEnum.READING_PROGRESS_MANAGE)
	async markChaptersRead(
		@Args('chapterIds', { type: () => [ID] }) chapterIds: string[],
		@GqlCurrentUser() user: CurrentUserDto,
	): Promise<ChapterReadResultModel[]> {
		return toResultModels(
			await this.chapterService.markChaptersAsRead(
				chapterIds,
				user.userId,
			),
		);
	}

	@Mutation(() => [ChapterReadResultModel], { name: 'markChaptersUnread' })
	@UseGuards(GqlJwtAuthGuard, PermissionsGuard)
	@Permissions(PermissionsEnum.READING_PROGRESS_MANAGE)
	async markChaptersUnread(
		@Args('chapterIds', { type: () => [ID] }) chapterIds: string[],
		@GqlCurrentUser() user: CurrentUserDto,
	): Promise<ChapterReadResultModel[]> {
		return toResultModels(
			await this.chapterService.markChaptersAsUnread(
				chapterIds,
				user.userId,
			),
		);
	}
}

function toResultModels(results: BatchReadResult[]): ChapterReadResultModel[] {
	return results.map(({ chapterId, success, error }) => ({
		chapterId,
		success,
		error: error ?? null,
	}));
}
