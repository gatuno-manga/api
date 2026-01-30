import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FileCleanupService } from '../../files/file-cleanup.service';
import { BookEvents } from '../constants/events.constant';

@Injectable()
export class FileDeletionEvents {
	private readonly logger = new Logger(FileDeletionEvents.name);

	constructor(private readonly fileCleanupService: FileCleanupService) {}

	@OnEvent(BookEvents.DELETED)
	async handleBookDeleted(event: {
		bookId: string;
		bookTitle: string;
		covers: string[];
		pages: string[];
	}) {
		this.logger.log(
			`Processing deletion of book files: ${event.bookTitle}`,
		);

		let deletedCount = 0;
		let errorCount = 0;

		for (const coverPath of event.covers) {
			try {
				await this.fileCleanupService.deleteFile(coverPath);
				deletedCount++;
			} catch (error) {
				this.logger.error(
					`Failed to delete cover file ${coverPath}:`,
					error,
				);
				errorCount++;
			}
		}

		for (const pagePath of event.pages) {
			try {
				await this.fileCleanupService.deleteFile(pagePath);
				deletedCount++;
			} catch (error) {
				this.logger.error(
					`Failed to delete page file ${pagePath}:`,
					error,
				);
				errorCount++;
			}
		}

		this.logger.log(
			`Book deletion completed: ${deletedCount} files deleted, ${errorCount} errors`,
		);
	}

	@OnEvent(BookEvents.CHAPTER_DELETED)
	async handleChapterDeleted(event: {
		chapterId: string;
		bookId?: string;
		pages: string[];
	}) {
		this.logger.log(
			`Processing deletion of chapter files: ${event.chapterId}`,
		);

		let deletedCount = 0;
		let errorCount = 0;

		// Deletar páginas
		for (const pagePath of event.pages) {
			try {
				await this.fileCleanupService.deleteFile(pagePath);
				deletedCount++;
			} catch (error) {
				this.logger.error(
					`Failed to delete page file ${pagePath}:`,
					error,
				);
				errorCount++;
			}
		}

		this.logger.log(
			`Chapter deletion completed: ${deletedCount} files deleted, ${errorCount} errors`,
		);
	}

	@OnEvent(BookEvents.COVER_DELETED)
	async handleCoverDeleted(event: { coverId: string; url: string }) {
		this.logger.log(`Processing deletion of cover file: ${event.coverId}`);

		try {
			await this.fileCleanupService.deleteFile(event.url);
			this.logger.log(`Cover file deleted successfully: ${event.url}`);
		} catch (error) {
			this.logger.error(
				`Failed to delete cover file ${event.url}:`,
				error,
			);
		}
	}

	@OnEvent(BookEvents.PAGE_DELETED)
	async handlePageDeleted(event: {
		pageId: number;
		chapterId: string;
		path: string;
	}) {
		this.logger.log(`Processing deletion of page file: ${event.pageId}`);

		try {
			await this.fileCleanupService.deleteFile(event.path);
			this.logger.log(`Page file deleted successfully: ${event.path}`);
		} catch (error) {
			this.logger.error(
				`Failed to delete page file ${event.path}:`,
				error,
			);
		}
	}
}
