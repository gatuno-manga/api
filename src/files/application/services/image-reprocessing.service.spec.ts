import { COVER_VARIANT_WIDTHS } from '@books/domain/constants/cover.constants';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import { DataSource } from 'typeorm';
import { ImageReprocessingService } from './image-reprocessing.service';

describe('ImageReprocessingService', () => {
	let service: ImageReprocessingService;
	let dataSourceMock: any;
	let eventPublisherMock: any;

	beforeEach(async () => {
		dataSourceMock = { query: jest.fn().mockResolvedValue([]) };
		eventPublisherMock = {
			publishImageProcessingRequest: jest
				.fn()
				.mockResolvedValue(undefined),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ImageReprocessingService,
				{ provide: DataSource, useValue: dataSourceMock },
				{
					provide: 'EVENT_PUBLISHER_PORT',
					useValue: eventPublisherMock,
				},
				{
					provide: AppConfigService,
					useValue: {
						imageReprocessing: {
							batchSize: 50,
							stuckThresholdHours: 6,
						},
					},
				},
			],
		}).compile();

		service = module.get<ImageReprocessingService>(
			ImageReprocessingService,
		);
	});

	describe('reprocessAll', () => {
		it('respects the configured batch size on every query', async () => {
			await service.reprocessAll();

			const limits = dataSourceMock.query.mock.calls.map(
				(call: unknown[]) => (call[1] as unknown[]).at(-1),
			);
			expect(limits.every((limit: number) => limit === 50)).toBe(true);
		});

		it('excludes external (http) urls from the outdated-images query for every table', async () => {
			await service.reprocessAll();

			const outdatedQueries = dataSourceMock.query.mock.calls
				.map((call: unknown[]) => call[0] as string)
				.filter((sql: string) => sql.includes('NOT LIKE'));

			expect(outdatedQueries.length).toBeGreaterThan(0);
			for (const sql of outdatedQueries) {
				expect(sql).toContain("NOT LIKE 'http%'");
			}
		});

		it('only checks for missing variants on the covers table, gated by the smallest configured width', async () => {
			await service.reprocessAll();

			const queriesByTable = dataSourceMock.query.mock.calls.reduce(
				(acc: Record<string, string[]>, call: unknown[]) => {
					const sql = call[0] as string;
					const table = /FROM (\w+)/.exec(sql)?.[1] ?? 'unknown';
					acc[table] = [...(acc[table] || []), sql];
					return acc;
				},
				{},
			);

			const smallestWidth = Math.min(...COVER_VARIANT_WIDTHS);
			for (const sql of queriesByTable.covers) {
				if (sql.includes('variants')) {
					expect(sql).toContain('variants IS NULL');
					expect(sql).toContain(`>= ${smallestWidth}`);
				}
			}

			for (const table of ['pages', 'user_images']) {
				for (const sql of queriesByTable[table]) {
					expect(sql).not.toContain('variants');
				}
			}
		});

		it('republishes stuck covers as non-backfill requests, with widths, deriving the target path from the raw key', async () => {
			dataSourceMock.query.mockImplementation((sql: string) => {
				if (
					sql.includes('FROM covers') &&
					sql.includes("LIKE 'processing/%'") &&
					!sql.includes('NOT LIKE')
				) {
					return Promise.resolve([
						{ id: 'cover-1', path: 'processing/ab/uuid.jpg' },
					]);
				}
				return Promise.resolve([]);
			});

			await service.reprocessAll();

			expect(
				eventPublisherMock.publishImageProcessingRequest,
			).toHaveBeenCalledWith({
				rawPath: 'processing/ab/uuid.jpg',
				targetBucket: StorageBucket.BOOKS,
				targetPath: 'ab/uuid.webp',
				isBackfill: false,
				widths: COVER_VARIANT_WIDTHS,
			});
		});

		it('republishes outdated covers in-place, with isBackfill:true and the bucket-prefixed rawPath', async () => {
			dataSourceMock.query.mockImplementation((sql: string) => {
				if (sql.includes('FROM covers') && sql.includes('NOT LIKE')) {
					return Promise.resolve([
						{ id: 'cover-2', path: 'ab/uuid.webp' },
					]);
				}
				return Promise.resolve([]);
			});

			await service.reprocessAll();

			expect(
				eventPublisherMock.publishImageProcessingRequest,
			).toHaveBeenCalledWith({
				rawPath: 'books/ab/uuid.webp',
				targetBucket: StorageBucket.BOOKS,
				targetPath: 'ab/uuid.webp',
				isBackfill: true,
				widths: COVER_VARIANT_WIDTHS,
			});
		});

		it('never requests widths for pages or user_images', async () => {
			dataSourceMock.query.mockImplementation((sql: string) => {
				if (sql.includes('FROM pages') && sql.includes('NOT LIKE')) {
					return Promise.resolve([{ id: 1, path: 'cd/page.webp' }]);
				}
				return Promise.resolve([]);
			});

			await service.reprocessAll();

			expect(
				eventPublisherMock.publishImageProcessingRequest,
			).toHaveBeenCalledWith(
				expect.objectContaining({ widths: undefined }),
			);
		});
	});

	describe('reprocessCoverById', () => {
		it('returns false and does not publish when the cover url is an external link', async () => {
			dataSourceMock.query.mockResolvedValueOnce([
				{ id: 'cover-3', path: 'https://external.com/cover.jpg' },
			]);

			const result = await service.reprocessCoverById('cover-3');

			expect(result).toBe(false);
			expect(
				eventPublisherMock.publishImageProcessingRequest,
			).not.toHaveBeenCalled();
		});

		it('returns false when the cover does not exist', async () => {
			dataSourceMock.query.mockResolvedValueOnce([]);

			const result = await service.reprocessCoverById('missing');

			expect(result).toBe(false);
		});
	});
});
