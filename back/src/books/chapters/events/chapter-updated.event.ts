export class ChapterUpdatedEvent {
	constructor(
		public readonly chapterId: string,
		public readonly bookId: string,
	) {}
}
