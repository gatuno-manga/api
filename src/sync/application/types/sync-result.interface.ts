import { ChapterCommentNode } from 'src/books/application/services/chapter-comments.service';
import { SavedPage } from 'src/users/infrastructure/database/entities/saved-page.entity';
import { SyncResponseDto } from 'src/users/infrastructure/http/dto/reading-progress.dto';

export interface ISyncResult {
	readingProgress: SyncResponseDto;
	savedPages: SavedPage[];
	comments: ChapterCommentNode[];
	syncedAt: Date;
}
