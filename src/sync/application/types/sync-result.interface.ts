import {
	ReadingProgressResponseDto,
	SyncResponseDto,
} from 'src/users/infrastructure/http/dto/reading-progress.dto';
import { SavedPage } from 'src/users/infrastructure/database/entities/saved-page.entity';
import { ChapterCommentNode } from 'src/books/application/services/chapter-comments.service';

export interface ISyncResult {
	readingProgress: SyncResponseDto;
	savedPages: SavedPage[];
	comments: ChapterCommentNode[];
	syncedAt: Date;
}
