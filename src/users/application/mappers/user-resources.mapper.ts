import { Injectable } from '@nestjs/common';
import {
	SavedPage as DomainSavedPage,
	SavedPageSnapshot,
} from '@users/domain/entities/saved-page';
import { ReadingProgress } from '@users/infrastructure/database/entities/reading-progress.entity';
import { SavedPage as OrmSavedPage } from '@users/infrastructure/database/entities/saved-page.entity';
import { User } from '@users/infrastructure/database/entities/user.entity';
import { ReadingProgressResponseDto } from '@users/infrastructure/http/dto/reading-progress.dto';
import { StorageBucket } from 'src/common/enum/storage-bucket.enum';
import { MediaUrlService } from 'src/common/services/media-url.service';

@Injectable()
export class UserResourcesMapper {
	constructor(private readonly mediaUrlService: MediaUrlService) {}

	toReadingProgressDto(
		progress: ReadingProgress,
	): ReadingProgressResponseDto {
		return {
			id: progress.id,
			chapterId: progress.chapterId,
			bookId: progress.bookId,
			pageIndex: progress.pageIndex,
			totalPages: progress.totalPages,
			completed: progress.completed,
			updatedAt: progress.updatedAt,
			deleted: !!progress.deletedAt,
		};
	}

	toReadingProgressDtoList(
		progressList: ReadingProgress[],
	): ReadingProgressResponseDto[] {
		return progressList.map((item) => this.toReadingProgressDto(item));
	}

	toSavedPage(savedPage: DomainSavedPage): SavedPageSnapshot {
		const snapshot = savedPage.toSnapshot();
		if (snapshot.page?.path) {
			snapshot.page.path = this.mediaUrlService.resolveUrl(
				snapshot.page.path as string,
				StorageBucket.BOOKS,
			);
		}
		return snapshot;
	}

	toSavedPageList(savedPages: DomainSavedPage[]): SavedPageSnapshot[] {
		return savedPages.map((savedPage) => this.toSavedPage(savedPage));
	}

	toUserProfile(user: User, permissions?: string[]) {
		return {
			id: user.id,
			userName: user.userName,
			name: user.name,
			email: user.email,
			roles: user.roles,
			permissions: permissions || [],
			maxWeightSensitiveContent: user.maxWeightSensitiveContent,
			profileImagePath: user.profilePicture?.path || null,
			profileImageMetadata: user.profilePicture?.metadata || null,
			profileImageUrl: this.mediaUrlService.resolveUrl(
				user.profilePicture?.path || null,
				StorageBucket.USERS,
			),
			profileBannerPath: user.profileBanner?.path || null,
			profileBannerMetadata: user.profileBanner?.metadata || null,
			profileBannerUrl: this.mediaUrlService.resolveUrl(
				user.profileBanner?.path || null,
				StorageBucket.USERS,
			),
			preferredLanguage: user.preferredLanguage,
			preferences: user.preferences,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		};
	}

	toPublicUserProfile(user: User) {
		return {
			id: user.id,
			userName: user.userName,
			name: user.name,
			profileImageUrl: this.mediaUrlService.resolveUrl(
				user.profilePicture?.path || null,
				StorageBucket.USERS,
			),
			profileBannerUrl: this.mediaUrlService.resolveUrl(
				user.profileBanner?.path || null,
				StorageBucket.USERS,
			),
			createdAt: user.createdAt,
		};
	}
}
