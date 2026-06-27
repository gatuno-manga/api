import { ChapterCommentNode } from 'src/books/application/services/chapter-comments.service';
import { SavedPageSnapshot } from 'src/users/domain/entities/saved-page';
import { SyncResponseDto } from 'src/users/infrastructure/http/dto/reading-progress.dto';

export interface ISyncResult {
	readingProgress: SyncResponseDto;
	savedPages: SavedPageSnapshot[];
	comments: ChapterCommentNode[];
	syncedAt: Date;
}
