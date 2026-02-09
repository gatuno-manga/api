import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Book } from '../books/entities/book.entity';
import { Chapter } from '../books/entities/chapter.entity';
import { Cover } from '../books/entities/cover.entity';
import { Page } from '../books/entities/page.entity';

export interface OrphanFile {
	filename: string;
	fullPath: string;
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
	private readonly downloadDir = path.resolve('/usr/src/app/data');
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
	) {
		this.retentionDays = this.configService.get<number>(
			'SOFT_DELETE_RETENTION_DAYS',
			10,
		);
	}

	async deleteFile(filePath: string): Promise<void> {
		try {
			const filename = filePath.replace('/data/', '');
			const fullPath = path.join(this.downloadDir, filename);

			try {
				const stats = await fs.stat(fullPath);
				if (stats.isDirectory()) {
					this.logger.warn(`Skipping directory: ${filename}`);
					return;
				}
			} catch (statError) {
				if (statError.code === 'ENOENT') {
					this.logger.warn(
						`File not found (already deleted?): ${filePath}`,
					);
					return;
				}
			}

			await fs.unlink(fullPath);
			this.logger.log(`File deleted: ${filename}`);
		} catch (error) {
			if (error.code !== 'ENOENT') {
				this.logger.error(`Error deleting file ${filePath}:`, error);
				throw error;
			}
			this.logger.warn(`File not found (already deleted?): ${filePath}`);
		}
	}

	async findOrphanFiles(): Promise<OrphanFile[]> {
		this.logger.log('Starting orphan file scan...');

		try {
			const files = await fs.readdir(this.downloadDir);

			const pages = await this.pageRepository.find({
				select: ['path'],
				withDeleted: true,
			});
			const covers = await this.coverRepository.find({
				select: ['url'],
				withDeleted: true,
			});

			const pageFiles = new Set(
				pages.map((p) => p.path.replace('/data/', '')),
			);
			const coverFiles = new Set(
				covers.map((c) => c.url.replace('/data/', '')),
			);
			const allReferencedFiles = new Set([...pageFiles, ...coverFiles]);

			const orphanFiles: OrphanFile[] = [];

			for (const filename of files) {
				if (!allReferencedFiles.has(filename)) {
					const fullPath = path.join(this.downloadDir, filename);

					try {
						const stats = await fs.stat(fullPath);

						if (stats.isDirectory()) {
							this.logger.debug(
								`Skipping directory: ${filename}`,
							);
							continue;
						}

						orphanFiles.push({
							filename,
							fullPath,
							size: stats.size,
							lastModified: stats.mtime,
							reason: 'no_page_reference',
						});
					} catch (error) {
						this.logger.error(
							`Error reading file stats for ${filename}:`,
							error,
						);
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
				await fs.unlink(file.fullPath);
				report.filesDeleted++;
				report.spaceRecovered += file.size;
				this.logger.log(`Deleted orphan file: ${file.filename}`);
			} catch (error) {
				const errorMsg = `Failed to delete ${file.filename}: ${error.message}`;
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
		this.logger.log('Starting missing file check...');

		const missingFiles: MissingFile[] = [];

		const pages = await this.pageRepository.find({
			relations: ['chapter', 'chapter.book'],
		});

		for (const page of pages) {
			const filename = page.path.replace('/data/', '');
			const fullPath = path.join(this.downloadDir, filename);

			try {
				await fs.access(fullPath);
			} catch {
				missingFiles.push({
					entityType: 'page',
					entityId: page.id,
					expectedPath: page.path,
					chapterId: page.chapter?.id,
					bookId: page.chapter?.book?.id,
				});
			}
		}

		const covers = await this.coverRepository.find({
			relations: ['book'],
		});

		for (const cover of covers) {
			const filename = cover.url.replace('/data/', '');
			const fullPath = path.join(this.downloadDir, filename);

			try {
				await fs.access(fullPath);
			} catch {
				missingFiles.push({
					entityType: 'cover',
					entityId: cover.id,
					expectedPath: cover.url,
					bookId: cover.book?.id,
				});
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
				const filename = page.path.replace('/data/', '');
				const fullPath = path.join(this.downloadDir, filename);
				const stats = await fs.stat(fullPath);

				await fs.unlink(fullPath);
				report.filesDeleted++;
				report.spaceRecovered += stats.size;

				await this.pageRepository.remove(page);

				this.logger.log(`Deleted old page file: ${filename}`);
			} catch (error) {
				if (error.code !== 'ENOENT') {
					const errorMsg = `Failed to delete page ${page.id}: ${error.message}`;
					this.logger.error(errorMsg);
					report.errors.push(errorMsg);
				}
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
				const filename = cover.url.replace('/data/', '');
				const fullPath = path.join(this.downloadDir, filename);
				const stats = await fs.stat(fullPath);

				await fs.unlink(fullPath);
				report.filesDeleted++;
				report.spaceRecovered += stats.size;

				await this.coverRepository.remove(cover);

				this.logger.log(`Deleted old cover file: ${filename}`);
			} catch (error) {
				if (error.code !== 'ENOENT') {
					const errorMsg = `Failed to delete cover ${cover.id}: ${error.message}`;
					this.logger.error(errorMsg);
					report.errors.push(errorMsg);
				}
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
		this.logger.log('Calculating storage statistics...');

		const files = await fs.readdir(this.downloadDir);
		let totalSize = 0;
		const fileCount = files.length;

		for (const filename of files) {
			try {
				const fullPath = path.join(this.downloadDir, filename);
				const stats = await fs.stat(fullPath);
				totalSize += stats.size;
			} catch (error) {
				this.logger.error(
					`Error reading file stats for ${filename}:`,
					error,
				);
			}
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
