import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClientProxy } from '@nestjs/microservices';
import { BookEvents } from '@books/domain/constants/events.constant';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { Chapter } from '@books/infrastructure/database/entities/chapter.entity';
import { MqttTopics } from '@common/domain/constants/mqtt-topics.constant';

@Injectable()
export class BooksNotifier {
	private readonly logger = new Logger(BooksNotifier.name);

	constructor(
		@Inject('MQTT_CLIENT')
		private readonly mqttClient: ClientProxy,
	) {}

	private publish(topic: string, event: string, payload: unknown) {
		this.mqttClient.emit(topic, { event, payload }).subscribe({
			error: (err) => {
				this.logger.error(
					`Failed to publish to ${topic}: ${err.message}`,
				);
			},
		});
	}

	// ==================== EVENTOS DE LIVROS ====================

	@OnEvent(BookEvents.CREATED)
	handleBookCreated(book: Book) {
		this.publish(MqttTopics.BOOKS.ADMIN, BookEvents.CREATED, {
			id: book.id,
			title: book.title,
			type: book.type,
			createdAt: book.createdAt,
		});
	}

	@OnEvent(BookEvents.UPDATED)
	handleBookUpdated(book: Book) {
		this.publish(MqttTopics.BOOKS.BOOK(book.id), BookEvents.UPDATED, {
			id: book.id,
			title: book.title,
			updatedAt: book.updatedAt,
		});
	}

	// ==================== EVENTOS DE CAPÍTULOS ====================

	@OnEvent(BookEvents.CHAPTERS_UPDATED)
	handleChaptersUpdated(payload: Chapter | Chapter[]) {
		const chapters = Array.isArray(payload) ? payload : [payload];
		if (!chapters || chapters.length === 0) return;

		const bookId = chapters[0]?.book?.id;
		const chapterData = chapters.map((ch) => ({
			id: ch.id,
			title: ch.title,
			index: ch.index,
			scrapingStatus: ch.scrapingStatus,
		}));

		// Envia para admin e para o livro
		this.publish(MqttTopics.BOOKS.ADMIN, BookEvents.CHAPTERS_UPDATED, {
			bookId,
			chapters: chapterData,
		});

		this.publish(
			MqttTopics.BOOKS.BOOK(bookId),
			BookEvents.CHAPTERS_UPDATED,
			{
				bookId,
				chapters: chapterData,
			},
		);

		// Envia para cada capítulo individual
		for (const chapter of chapters) {
			this.publish(
				MqttTopics.BOOKS.CHAPTER(chapter.id),
				BookEvents.CHAPTER_UPDATED,
				{
					bookId,
					chapter: {
						id: chapter.id,
						title: chapter.title,
						index: chapter.index,
						scrapingStatus: chapter.scrapingStatus,
					},
				},
			);
		}
	}

	@OnEvent(BookEvents.CHAPTERS_FIX)
	handleChaptersFix(chapters: Chapter[]) {
		if (!chapters || chapters.length === 0) return;
		const bookId = chapters[0]?.book?.id;

		this.publish(MqttTopics.BOOKS.ADMIN, BookEvents.CHAPTERS_FIX, {
			bookId,
			chapterIds: chapters.map((ch) => ch.id),
		});
	}

	// ==================== EVENTOS DE SCRAPING ====================

	@OnEvent(BookEvents.SCRAPING_STARTED)
	handleChapterScrapingStarted(data: { chapterId: string; bookId: string }) {
		this.publish(
			MqttTopics.BOOKS.BOOK(data.bookId),
			BookEvents.SCRAPING_STARTED,
			data,
		);
		this.publish(
			MqttTopics.BOOKS.CHAPTER(data.chapterId),
			BookEvents.SCRAPING_STARTED,
			data,
		);
		this.publish(MqttTopics.BOOKS.ADMIN, BookEvents.SCRAPING_STARTED, data);
	}

	@OnEvent(BookEvents.SCRAPING_COMPLETED)
	handleChapterScrapingCompleted(data: {
		chapterId: string;
		bookId: string;
		pagesCount: number;
	}) {
		this.publish(
			MqttTopics.BOOKS.BOOK(data.bookId),
			BookEvents.SCRAPING_COMPLETED,
			data,
		);
		this.publish(
			MqttTopics.BOOKS.CHAPTER(data.chapterId),
			BookEvents.SCRAPING_COMPLETED,
			data,
		);
		this.publish(
			MqttTopics.BOOKS.ADMIN,
			BookEvents.SCRAPING_COMPLETED,
			data,
		);
	}

	@OnEvent(BookEvents.SCRAPING_FAILED)
	handleChapterScrapingFailed(data: {
		chapterId: string;
		bookId: string;
		error: string;
	}) {
		this.publish(
			MqttTopics.BOOKS.BOOK(data.bookId),
			BookEvents.SCRAPING_FAILED,
			data,
		);
		this.publish(
			MqttTopics.BOOKS.CHAPTER(data.chapterId),
			BookEvents.SCRAPING_FAILED,
			data,
		);
		this.publish(MqttTopics.BOOKS.ADMIN, BookEvents.SCRAPING_FAILED, data);
	}

	// ==================== EVENTOS DE CAPA ====================

	@OnEvent(BookEvents.COVER_PROCESSED)
	handleCoverProcessed(data: {
		bookId: string;
		coverId: string;
		url: string;
	}) {
		this.publish(MqttTopics.BOOKS.ADMIN, BookEvents.COVER_PROCESSED, data);
	}

	@OnEvent(BookEvents.COVER_SELECTED)
	handleCoverSelected(data: { bookId: string; coverId: string }) {
		this.publish(
			MqttTopics.BOOKS.BOOK(data.bookId),
			BookEvents.COVER_SELECTED,
			data,
		);
		this.publish(MqttTopics.BOOKS.ADMIN, BookEvents.COVER_SELECTED, data);
	}

	@OnEvent(BookEvents.COVER_UPDATED)
	handleCoverUpdated(data: { bookId: string; coverId: string }) {
		this.publish(
			MqttTopics.BOOKS.BOOK(data.bookId),
			BookEvents.COVER_UPDATED,
			data,
		);
		this.publish(MqttTopics.BOOKS.ADMIN, BookEvents.COVER_UPDATED, data);
	}

	@OnEvent(BookEvents.COVER_UPLOADED)
	handleCoverUploaded(data: {
		bookId: string;
		coverId: string;
		url: string;
	}) {
		this.publish(
			MqttTopics.BOOKS.BOOK(data.bookId),
			BookEvents.COVER_UPLOADED,
			data,
		);
		this.publish(MqttTopics.BOOKS.ADMIN, BookEvents.COVER_UPLOADED, data);
	}

	@OnEvent(BookEvents.COVERS_UPLOADED)
	handleCoversUploaded(data: {
		bookId: string;
		coverIds: string[];
		count: number;
	}) {
		this.publish(
			MqttTopics.BOOKS.BOOK(data.bookId),
			BookEvents.COVERS_UPLOADED,
			data,
		);
		this.publish(MqttTopics.BOOKS.ADMIN, BookEvents.COVERS_UPLOADED, data);
	}

	// ==================== EVENTOS DE CAPÍTULOS CRIADOS/UPLOAD ====================

	@OnEvent(BookEvents.CHAPTER_CREATED)
	handleChapterCreated(chapter: Chapter) {
		const bookId = chapter.book?.id;
		const chapterData = {
			id: chapter.id,
			title: chapter.title,
			index: chapter.index,
			scrapingStatus: chapter.scrapingStatus,
			bookId,
		};

		this.publish(
			MqttTopics.BOOKS.BOOK(bookId),
			BookEvents.CHAPTER_CREATED,
			chapterData,
		);
		this.publish(
			MqttTopics.BOOKS.ADMIN,
			BookEvents.CHAPTER_CREATED,
			chapterData,
		);
	}

	@OnEvent(BookEvents.PAGES_UPLOADED)
	handleChapterPagesUploaded(data: {
		bookId: string;
		chapterId: string;
		count: number;
	}) {
		this.publish(
			MqttTopics.BOOKS.BOOK(data.bookId),
			BookEvents.PAGES_UPLOADED,
			data,
		);
		this.publish(
			MqttTopics.BOOKS.CHAPTER(data.chapterId),
			BookEvents.PAGES_UPLOADED,
			data,
		);
		this.publish(MqttTopics.BOOKS.ADMIN, BookEvents.PAGES_UPLOADED, data);
	}

	// ==================== EVENTOS DE DELEÇÃO ====================

	@OnEvent(BookEvents.DELETED)
	handleBookDeleted(data: {
		bookId: string;
		bookTitle: string;
		covers: string[];
		pages: string[];
	}) {
		const eventData = {
			bookId: data.bookId,
			title: data.bookTitle,
			filesCount: data.covers.length + data.pages.length,
		};
		this.publish(MqttTopics.BOOKS.ADMIN, BookEvents.DELETED, eventData);
		this.publish(
			MqttTopics.BOOKS.BOOK(data.bookId),
			BookEvents.DELETED,
			eventData,
		);
	}

	@OnEvent(BookEvents.CHAPTER_DELETED)
	handleChapterDeleted(data: {
		chapterId: string;
		bookId?: string;
		pages: string[];
	}) {
		const eventData = {
			chapterId: data.chapterId,
			bookId: data.bookId,
			pagesCount: data.pages.length,
		};

		this.publish(
			MqttTopics.BOOKS.ADMIN,
			BookEvents.CHAPTER_DELETED,
			eventData,
		);
		this.publish(
			MqttTopics.BOOKS.CHAPTER(data.chapterId),
			BookEvents.CHAPTER_DELETED,
			eventData,
		);
		if (data.bookId) {
			this.publish(
				MqttTopics.BOOKS.BOOK(data.bookId),
				BookEvents.CHAPTER_DELETED,
				eventData,
			);
		}
	}

	@OnEvent(BookEvents.NEW_CHAPTERS)
	handleBookNewChapters(data: {
		bookId: string;
		newChaptersCount: number;
		chapters: Array<{ id: string; title: string; index: number }>;
	}) {
		this.publish(
			MqttTopics.BOOKS.BOOK(data.bookId),
			BookEvents.NEW_CHAPTERS,
			data,
		);
		this.publish(MqttTopics.BOOKS.ADMIN, BookEvents.NEW_CHAPTERS, data);
	}

	@OnEvent(BookEvents.UPDATE_STARTED)
	handleBookUpdateStarted(data: {
		bookId: string;
		bookTitle: string;
		jobId: string;
		timestamp: number;
	}) {
		this.publish(MqttTopics.BOOKS.ADMIN, BookEvents.UPDATE_STARTED, data);
	}

	@OnEvent(BookEvents.UPDATE_COMPLETED)
	handleBookUpdateCompleted(data: {
		bookId: string;
		bookTitle: string;
		jobId: string;
		newChapters: number;
		newCovers: number;
		timestamp: number;
	}) {
		this.publish(MqttTopics.BOOKS.ADMIN, BookEvents.UPDATE_COMPLETED, data);
	}

	@OnEvent(BookEvents.UPDATE_FAILED)
	handleBookUpdateFailed(data: {
		bookId: string;
		bookTitle: string;
		jobId: string;
		error: string;
		timestamp: number;
	}) {
		this.publish(MqttTopics.BOOKS.ADMIN, BookEvents.UPDATE_FAILED, data);
	}
}
