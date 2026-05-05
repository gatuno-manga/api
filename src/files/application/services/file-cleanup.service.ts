import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { Chapter } from '@books/infrastructure/database/entities/chapter.entity';
import { Cover } from '@books/infrastructure/database/entities/cover.entity';
import { Page } from '@books/infrastructure/database/entities/page.entity';
import {
	StoragePort,
	FileMetadata,
} from '@files/application/ports/storage.port';

export interface OrphanFile {
	filename: string;
	size: number;
	lastModified: Date;
	reason: 'no_page_reference' | 'no_cover_reference';
}

export interface MissingFile {
	entityType: 'page' | 'cover';
	entityId: string | number;
	expectedPath: string;
	bookId?: string;
	chapterId?: string;
}

export interface CleanupReport {
	totalFilesScanned: number;
	orphanFilesFound: number;
	filesDeleted: number;
	spaceRecovered: number;
	errors: string[];
	dryRun: boolean;
}

@Injectable()
export class FileCleanupService {
	private readonly logger = new Logger(FileCleanupService.name);
	private readonly retentionDays: number;

	constructor(
		@InjectRepository(Page)
		private readonly pageRepository: Repository<Page>,
		@InjectRepository(Cover)
		private readonly coverRepository: Repository<Cover>,
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		private readonly configService: ConfigService,
		@Inject('STORAGE_PORT') private readonly storagePort: StoragePort,
	) {
		this.retentionDays = this.configService.get<number>(
			'SOFT_DELETE_RETENTION_DAYS',
			10,
		);
	}

	private getErrorMessage(error: unknown): string {
		if (
			typeof error === 'object' &&
			error !== null &&
			'message' in error &&
			typeof (error as { message?: unknown }).message === 'string'
		) {
			return (error as { message: string }).message;
		}
		return error instanceof Error ? error.message : String(error);
	}

	async deleteFile(filePath: string): Promise<void> {
		try {
			const fileKey = filePath.replace('/data/', '');
			await this.storagePort.delete(fileKey);
			this.logger.log(`File deleted from Storage: ${fileKey}`);
		} catch (error: unknown) {
			this.logger.error(
				`Error deleting file ${filePath} from Storage:`,
				error,
			);
			throw error;
		}
	}

	async findOrphanFiles(): Promise<OrphanFile[]> {
		this.logger.log('Starting orphan file scan (Storage mode)...');

		try {
			const pages = await this.pageRepository.find({
				select: ['path'],
				withDeleted: true,
			});
			const covers = await this.coverRepository.find({
				select: ['url'],
				withDeleted: true,
			});

			const allReferencedFiles = new Set([
				...pages.map((p) => p.path.replace('/data/', '')),
				...covers.map((c) => c.url.replace('/data/', '')),
			]);

			const orphanFiles: OrphanFile[] = [];

			for await (const file of this.storagePort.listAllFiles()) {
				if (!allReferencedFiles.has(file.filename)) {
					orphanFiles.push({
						filename: file.filename,
						size: file.size,
						lastModified: file.mtime,
						reason: 'no_page_reference',
					});

					if (orphanFiles.length >= 10000) {
						this.logger.warn(
							'Too many orphan files found, truncating list at 10k items for safety.',
						);
						break;
					}
				}
			}

			this.logger.log(`Found ${orphanFiles.length} orphan files`);
			return orphanFiles;
		} catch (error) {
			this.logger.error('Error scanning for orphan files:', error);
			throw error;
		}
	}

	async cleanupOrphanFiles(dryRun = true): Promise<CleanupReport> {
		this.logger.log(`Starting orphan cleanup (dryRun: ${dryRun})...`);

		const orphanFiles = await this.findOrphanFiles();
		const report: CleanupReport = {
			totalFilesScanned: orphanFiles.length,
			orphanFilesFound: orphanFiles.length,
			filesDeleted: 0,
			spaceRecovered: 0,
			errors: [],
			dryRun,
		};

		if (dryRun) {
			this.logger.log('Dry run - no files will be deleted');
			return report;
		}

		for (const file of orphanFiles) {
			try {
				await this.storagePort.delete(file.filename);
				report.filesDeleted++;
				report.spaceRecovered += file.size;
				this.logger.log(`Deleted orphan file: ${file.filename}`);
			} catch (error: unknown) {
				const errorMsg = `Failed to delete ${file.filename}: ${this.getErrorMessage(error)}`;
				this.logger.error(errorMsg);
				report.errors.push(errorMsg);
			}
		}

		this.logger.log(
			`Cleanup completed: ${report.filesDeleted} files deleted, ${(report.spaceRecovered / 1024 / 1024).toFixed(2)} MB recovered`,
		);
		return report;
	}

	async cleanupOrphansImmediate(): Promise<CleanupReport> {
		this.logger.log('Starting immediate orphan cleanup...');
		return this.cleanupOrphanFiles(false);
	}

	async findMissingFiles(): Promise<MissingFile[]> {
		this.logger.log('Starting missing file check (Batch mode)...');

		const missingFiles: MissingFile[] = [];
		const batchSize = 1000;

		// Processa Pages em lotes
		let offset = 0;
		while (true) {
			const pages = await this.pageRepository.find({
				relations: ['chapter', 'chapter.book'],
				take: batchSize,
				skip: offset,
			});

			if (pages.length === 0) break;

			for (const page of pages) {
				const fileKey = page.path.replace('/data/', '');
				const exists = await this.storagePort.exists(fileKey);
				if (!exists) {
					missingFiles.push({
						entityType: 'page',
						entityId: page.id,
						expectedPath: page.path,
						chapterId: page.chapter?.id,
						bookId: page.chapter?.book?.id,
					});
				}
			}

			offset += batchSize;
			if (missingFiles.length >= 1000) {
				this.logger.warn(
					'Too many missing files found, truncating report at 1k items.',
				);
				break;
			}
		}

		// Processa Covers em lotes (se não atingiu o limite)
		if (missingFiles.length < 1000) {
			offset = 0;
			while (true) {
				const covers = await this.coverRepository.find({
					relations: ['book'],
					take: batchSize,
					skip: offset,
				});

				if (covers.length === 0) break;

				for (const cover of covers) {
					const fileKey = cover.url.replace('/data/', '');
					const exists = await this.storagePort.exists(fileKey);
					if (!exists) {
						missingFiles.push({
							entityType: 'cover',
							entityId: cover.id,
							expectedPath: cover.url,
							bookId: cover.book?.id,
						});
					}
				}

				offset += batchSize;
				if (missingFiles.length >= 1000) break;
			}
		}

		this.logger.log(`Found ${missingFiles.length} missing files`);
		return missingFiles;
	}

	async cleanupOldDeletedFiles(): Promise<CleanupReport> {
		this.logger.log(
			`Cleaning up files deleted more than ${this.retentionDays} days ago...`,
		);

		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

		const report: CleanupReport = {
			totalFilesScanned: 0,
			orphanFilesFound: 0,
			filesDeleted: 0,
			spaceRecovered: 0,
			errors: [],
			dryRun: false,
		};

		const oldPages = await this.pageRepository.find({
			where: {
				deletedAt: LessThan(cutoffDate),
			},
			withDeleted: true,
		});

		for (const page of oldPages) {
			try {
				const fileKey = page.path.replace('/data/', '');
				const stats = await this.storagePort.getStats(fileKey);

				await this.storagePort.delete(fileKey);
				report.filesDeleted++;
				report.spaceRecovered += stats.size;

				await this.pageRepository.remove(page);

				this.logger.log(`Deleted old page file: ${fileKey}`);
			} catch (error: unknown) {
				const errorMsg = `Failed to delete page ${page.id}: ${this.getErrorMessage(error)}`;
				this.logger.error(errorMsg);
				report.errors.push(errorMsg);
			}
		}

		const oldCovers = await this.coverRepository.find({
			where: {
				deletedAt: LessThan(cutoffDate),
			},
			withDeleted: true,
		});

		for (const cover of oldCovers) {
			try {
				const fileKey = cover.url.replace('/data/', '');
				const stats = await this.storagePort.getStats(fileKey);

				await this.storagePort.delete(fileKey);
				report.filesDeleted++;
				report.spaceRecovered += stats.size;

				await this.coverRepository.remove(cover);

				this.logger.log(`Deleted old cover file: ${fileKey}`);
			} catch (error: unknown) {
				const errorMsg = `Failed to delete cover ${cover.id}: ${this.getErrorMessage(error)}`;
				this.logger.error(errorMsg);
				report.errors.push(errorMsg);
			}
		}

		const oldChapters = await this.chapterRepository.find({
			where: {
				deletedAt: LessThan(cutoffDate),
			},
			withDeleted: true,
		});

		for (const chapter of oldChapters) {
			await this.chapterRepository.remove(chapter);
		}

		const oldBooks = await this.bookRepository.find({
			where: {
				deletedAt: LessThan(cutoffDate),
			},
			withDeleted: true,
		});

		for (const book of oldBooks) {
			await this.bookRepository.remove(book);
		}

		report.totalFilesScanned = oldPages.length + oldCovers.length;
		report.orphanFilesFound = report.filesDeleted;

		this.logger.log(
			`Cleanup completed: ${report.filesDeleted} files deleted, ${(report.spaceRecovered / 1024 / 1024).toFixed(2)} MB recovered`,
		);
		return report;
	}

	async getStorageStatistics(): Promise<{
		totalFiles: number;
		totalSize: number;
		totalSizeMB: string;
		referencedPages: number;
		referencedCovers: number;
		deletedPages: number;
		deletedCovers: number;
		retentionDays: number;
	}> {
		this.logger.log(
			'Calculating storage statistics (S3 Streaming mode)...',
		);

		let totalSize = 0;
		let fileCount = 0;

		for await (const file of this.storagePort.listAllFiles()) {
			totalSize += file.size;
			fileCount++;
		}

		const pages = await this.pageRepository.count();
		const covers = await this.coverRepository.count();
		const deletedPages =
			(await this.pageRepository.count({ withDeleted: true })) - pages;
		const deletedCovers =
			(await this.coverRepository.count({ withDeleted: true })) - covers;

		return {
			totalFiles: fileCount,
			totalSize: totalSize,
			totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
			referencedPages: pages,
			referencedCovers: covers,
			deletedPages,
			deletedCovers,
			retentionDays: this.retentionDays,
		};
	}
}
