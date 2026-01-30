export const BookEvents = {
	// Socket Events (Client -> Server)
	SUBSCRIBE_BOOK: 'subscribe:book',
	SUBSCRIBE_CHAPTER: 'subscribe:chapter',
	UNSUBSCRIBE_BOOK: 'unsubscribe:book',
	UNSUBSCRIBE_CHAPTER: 'unsubscribe:chapter',
	LIST_SUBSCRIPTIONS: 'list:subscriptions',

	// Book Events
	CREATED: 'book.created',
	UPDATED: 'book.updated',
	DELETED: 'book.deleted',
	NEW_CHAPTERS: 'book.new-chapters',
	UPDATE_STARTED: 'book.update.started',
	UPDATE_COMPLETED: 'book.update.completed',
	UPDATE_FAILED: 'book.update.failed',

	// Chapter Events
	CHAPTER_CREATED: 'chapter.created',
	CHAPTERS_UPDATED: 'chapters.updated', // Bulk update
	CHAPTER_UPDATED: 'chapter.updated', // Single update (used in loops)
	CHAPTERS_FIX: 'chapters.fix',
	CHAPTER_DELETED: 'chapter.deleted',
	PAGES_UPLOADED: 'chapter.pages.uploaded',

	// Scraping Events
	SCRAPING_STARTED: 'chapter.scraping.started',
	SCRAPING_COMPLETED: 'chapter.scraping.completed',
	SCRAPING_FAILED: 'chapter.scraping.failed',

	// Cover Events
	COVER_PROCESSED: 'cover.processed',
	COVER_SELECTED: 'cover.selected',
	COVER_UPDATED: 'cover.updated',
	COVER_UPLOADED: 'cover.uploaded', // Single upload
	COVERS_UPLOADED: 'covers.uploaded', // Multiple upload
	COVER_DELETED: 'cover.deleted',

	// Page Events
	PAGE_DELETED: 'page.deleted',
} as const;
