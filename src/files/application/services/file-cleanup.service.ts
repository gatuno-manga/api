import { AppConfigService } from '@/infrastructure/app-config/app-config.service';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { Chapter } from '@books/infrastructure/database/entities/chapter.entity';
import { Cover } from '@books/infrastructure/database/entities/cover.entity';
import { Page } from '@books/infrastructure/database/entities/page.entity';
import { StoragePort } from '@files/application/ports/storage.port';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';

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
		private readonly appConfigService: AppConfigService,
		@Inject('STORAGE_PORT') private readonly storagePort: StoragePort,
	) {
		this.retentionDays = this.appConfigService.fileCleanup.retentionDays;
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
		this.logger.log(
			'Starting orphan file scan (Storage mode - Batched)...',
		);

		try {
			const orphanFiles: OrphanFile[] = [];
			let fileBatch: { filename: string; size: number; mtime: Date }[] =
				[];
			const batchSize = 1000;

			const processBatch = async (batch: typeof fileBatch) => {
				const pathsToSearch = batch.map((f) => `/data/${f.filename}`);

				const pages = await this.pageRepository.find({
					select: ['path'],
					where: { path: In(pathsToSearch) },
					withDeleted: true,
				});

				const covers = await this.coverRepository.find({
					select: ['url'],
					where: { url: In(pathsToSearch) },
					withDeleted: true,
				});

				const foundPaths = new Set([
					...pages.map((p) => p.path),
					...covers.map((c) => c.url),
				]);

				for (const file of batch) {
					const expectedPath = `/data/${file.filename}`;
					if (!foundPaths.has(expectedPath)) {
						orphanFiles.push({
							filename: file.filename,
							size: file.size,
							lastModified: file.mtime,
							reason: 'no_page_reference',
						});
					}
				}
			};

			for await (const file of this.storagePort.listAllFiles()) {
				fileBatch.push(file);
				if (fileBatch.length >= batchSize) {
					await processBatch(fileBatch);
					fileBatch = [];
					if (orphanFiles.length >= 10000) {
						this.logger.warn(
							'Too many orphan files found, truncating list at 10k items for safety.',
						);
						break;
					}
				}
			}

			if (fileBatch.length > 0 && orphanFiles.length < 10000) {
				await processBatch(fileBatch);
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
		this.logger.log(
			'Starting missing file check (Batch mode - Parallel Storage Check)...',
		);

		const missingFiles: MissingFile[] = [];
		const dbBatchSize = 1000;
		const storageConcurrency = 50;

		let offset = 0;
		while (true) {
			const pages = await this.pageRepository.find({
				relations: ['chapter', 'chapter.book'],
				take: dbBatchSize,
				skip: offset,
			});

			if (pages.length === 0) break;

			for (let i = 0; i < pages.length; i += storageConcurrency) {
				const chunk = pages.slice(i, i + storageConcurrency);

				await Promise.all(
					chunk.map(async (page) => {
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
					}),
				);
			}

			offset += dbBatchSize;
			if (missingFiles.length >= 1000) {
				this.logger.warn(
					'Too many missing files found, truncating report at 1k items.',
				);
				break;
			}
		}

		if (missingFiles.length < 1000) {
			offset = 0;
			while (true) {
				const covers = await this.coverRepository.find({
					relations: ['book'],
					take: dbBatchSize,
					skip: offset,
				});

				if (covers.length === 0) break;

				for (let i = 0; i < covers.length; i += storageConcurrency) {
					const chunk = covers.slice(i, i + storageConcurrency);

					await Promise.all(
						chunk.map(async (cover) => {
							const fileKey = cover.url.replace('/data/', '');
							const exists =
								await this.storagePort.exists(fileKey);
							if (!exists) {
								missingFiles.push({
									entityType: 'cover',
									entityId: cover.id,
									expectedPath: cover.url,
									bookId: cover.book?.id,
								});
							}
						}),
					);
				}

				offset += dbBatchSize;
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

		const batchSize = 500;
		const concurrency = 20;

		// Cleanup old pages
		while (true) {
			const oldPages = await this.pageRepository.find({
				where: { deletedAt: LessThan(cutoffDate) },
				withDeleted: true,
				take: batchSize,
			});

			if (oldPages.length === 0) break;

			report.totalFilesScanned += oldPages.length;

			for (let i = 0; i < oldPages.length; i += concurrency) {
				const chunk = oldPages.slice(i, i + concurrency);
				await Promise.all(
					chunk.map(async (page) => {
						try {
							const fileKey = page.path.replace('/data/', '');
							let size = 0;
							try {
								const stats =
									await this.storagePort.getStats(fileKey);
								size = stats.size;
							} catch {
								// File may no longer exist in storage; size stays 0
							}

							let fileDeleted = false;
							try {
								await this.storagePort.delete(fileKey);
								fileDeleted = true;
							} catch {
								// File already absent from storage — safe to remove DB record
								fileDeleted = true;
							}

							if (fileDeleted) {
								report.filesDeleted++;
								report.spaceRecovered += size;
								await this.pageRepository.remove(page);
								this.logger.log(
									`Deleted old page file and record: ${fileKey}`,
								);
							}
						} catch (error: unknown) {
							const errorMsg = `Failed to delete page ${page.id}: ${this.getErrorMessage(error)}`;
							this.logger.error(errorMsg);
							report.errors.push(errorMsg);
						}
					}),
				);
			}
		}

		// Cleanup old covers
		while (true) {
			const oldCovers = await this.coverRepository.find({
				where: { deletedAt: LessThan(cutoffDate) },
				withDeleted: true,
				take: batchSize,
			});

			if (oldCovers.length === 0) break;

			report.totalFilesScanned += oldCovers.length;

			for (let i = 0; i < oldCovers.length; i += concurrency) {
				const chunk = oldCovers.slice(i, i + concurrency);
				await Promise.all(
					chunk.map(async (cover) => {
						try {
							const fileKey = cover.url.replace('/data/', '');
							let size = 0;
							try {
								const stats =
									await this.storagePort.getStats(fileKey);
								size = stats.size;
							} catch {
								// File may no longer exist in storage; size stays 0
							}

							let fileDeleted = false;
							try {
								await this.storagePort.delete(fileKey);
								fileDeleted = true;
							} catch {
								// File already absent from storage — safe to remove DB record
								fileDeleted = true;
							}

							if (fileDeleted) {
								report.filesDeleted++;
								report.spaceRecovered += size;
								await this.coverRepository.remove(cover);
								this.logger.log(
									`Deleted old cover file and record: ${fileKey}`,
								);
							}
						} catch (error: unknown) {
							const errorMsg = `Failed to delete cover ${cover.id}: ${this.getErrorMessage(error)}`;
							this.logger.error(errorMsg);
							report.errors.push(errorMsg);
						}
					}),
				);
			}
		}

		// Cleanup old chapters
		while (true) {
			const oldChapters = await this.chapterRepository.find({
				where: { deletedAt: LessThan(cutoffDate) },
				withDeleted: true,
				take: batchSize,
			});
			if (oldChapters.length === 0) break;

			for (let i = 0; i < oldChapters.length; i += concurrency) {
				const chunk = oldChapters.slice(i, i + concurrency);
				await Promise.all(
					chunk.map((c) =>
						this.chapterRepository.remove(c).catch((e) => {
							this.logger.error(
								`Error removing old chapter ${c.id}: ${this.getErrorMessage(e)}`,
							);
						}),
					),
				);
			}
		}

		// Cleanup old books
		while (true) {
			const oldBooks = await this.bookRepository.find({
				where: { deletedAt: LessThan(cutoffDate) },
				withDeleted: true,
				take: batchSize,
			});
			if (oldBooks.length === 0) break;

			for (let i = 0; i < oldBooks.length; i += concurrency) {
				const chunk = oldBooks.slice(i, i + concurrency);
				await Promise.all(
					chunk.map((b) =>
						this.bookRepository.remove(b).catch((e) => {
							this.logger.error(
								`Error removing old book ${b.id}: ${this.getErrorMessage(e)}`,
							);
						}),
					),
				);
			}
		}

		// filesDeleted already tracks the number of DB records hard-deleted above.
		// orphanFilesFound is reserved for files found in storage without a DB reference
		// (see cleanupOrphanFiles). Do NOT assign filesDeleted to orphanFilesFound here.

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
