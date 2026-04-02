import { Injectable } from '@nestjs/common';
import { AppConfigService } from 'src/app-config/app-config.service';
import { ReadingProgressResponseDto } from './dto/reading-progress.dto';
import { ReadingProgress } from './entities/reading-progress.entity';
import { User } from './entities/user.entity';
import { SavedPage } from './saved-pages/entities/saved-page.entity';

@Injectable()
export class UserResourcesMapper {
	constructor(private readonly appConfig: AppConfigService) {}

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

		savedPage.page.path = this.toAbsoluteMediaUrl(savedPage.page.path);
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
			profileImagePath: user.profileImagePath,
			profileImageUrl: this.toAbsoluteMediaUrl(user.profileImagePath),
			profileBannerPath: user.profileBannerPath,
			profileBannerUrl: this.toAbsoluteMediaUrl(user.profileBannerPath),
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		};
	}

	toPublicUserProfile(user: User) {
		return {
			id: user.id,
			userName: user.userName,
			name: user.name,
			profileImageUrl: this.toAbsoluteMediaUrl(user.profileImagePath),
			profileBannerUrl: this.toAbsoluteMediaUrl(user.profileBannerPath),
			createdAt: user.createdAt,
		};
	}

	private toAbsoluteMediaUrl(url: string | null): string {
		if (
			!url ||
			url.startsWith('null') ||
			url.startsWith('undefined') ||
			url.startsWith('http')
		) {
			return url || '';
		}

		return `${this.appConfig.apiUrl}${url}`;
	}
}
