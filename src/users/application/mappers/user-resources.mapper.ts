import { Injectable } from '@nestjs/common';
import { StorageBucket } from 'src/common/enum/storage-bucket.enum';
import { MediaUrlService } from 'src/common/services/media-url.service';
import { ReadingProgress } from '../../infrastructure/database/entities/reading-progress.entity';
import { SavedPage } from '../../infrastructure/database/entities/saved-page.entity';
import { User } from '../../infrastructure/database/entities/user.entity';
import { ReadingProgressResponseDto } from '../../infrastructure/http/dto/reading-progress.dto';

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
		};
	}

	toReadingProgressDtoList(
		progressList: ReadingProgress[],
	): ReadingProgressResponseDto[] {
		return progressList.map((item) => this.toReadingProgressDto(item));
	}

	toSavedPage(savedPage: SavedPage): SavedPage {
		if (!savedPage.page) {
			return savedPage;
		}

		savedPage.page.path = this.mediaUrlService.resolveUrl(
			savedPage.page.path,
			StorageBucket.BOOKS,
		);
		return savedPage;
	}

	toSavedPageList(savedPages: SavedPage[]): SavedPage[] {
		return savedPages.map((savedPage) => this.toSavedPage(savedPage));
	}

	toUserProfile(user: User) {
		return {
			id: user.id,
			userName: user.userName,
			name: user.name,
			email: user.email,
			roles: user.roles,
			maxWeightSensitiveContent: user.maxWeightSensitiveContent,
			profileImagePath: user.profilePicture?.path || null,
			profileImageWidth: user.profilePicture?.width || null,
			profileImageHeight: user.profilePicture?.height || null,
			profileImageUrl: this.mediaUrlService.resolveUrl(
				user.profilePicture?.path || null,
				StorageBucket.USERS,
			),
			profileBannerPath: user.profileBanner?.path || null,
			profileBannerWidth: user.profileBanner?.width || null,
			profileBannerHeight: user.profileBanner?.height || null,
			profileBannerUrl: this.mediaUrlService.resolveUrl(
				user.profileBanner?.path || null,
				StorageBucket.USERS,
			),
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
