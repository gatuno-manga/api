import { BadRequestException, INestApplication } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { PublicationStatus } from 'src/books/domain/enums/publication-status.enum';
import { ScrapingStatus } from 'src/books/domain/enums/scrapingStatus.enum';
import { Book } from 'src/books/infrastructure/database/entities/book.entity';
import { Cover } from 'src/books/infrastructure/database/entities/cover.entity';
import { BooksKafkaConsumer } from 'src/books/infrastructure/messaging/books-kafka.consumer';
import { ImageReprocessingService } from 'src/files/application/services/image-reprocessing.service';
import { HandleImageProcessingCompletedUseCase } from 'src/files/application/use-cases/handle-image-processing-completed.use-case';
import { RedisService } from 'src/infrastructure/redis/redis.service';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { createE2EApp } from './helpers/e2e-app.helper';

jest.setTimeout(120000);

const ADMIN_EMAIL = `admin-variants-${uuidv7()}@gatuno.local`;
const ADMIN_PASSWORD = 'AdminPassword123!';

interface AuthResultPayload {
	accessToken: string;
	sessionId: string;
}

function extractPayload<T>(body: unknown): T {
	if (
		typeof body === 'object' &&
		body !== null &&
		'data' in (body as Record<string, unknown>) &&
		(body as Record<string, unknown>).data
	) {
		return (body as { data: T }).data;
	}
	return body as T;
}

describe('Cover Variants and Reprocessing Pipeline (e2e)', () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let redisService: RedisService;
	let handleImageProcessingUseCase: HandleImageProcessingCompletedUseCase;
	let booksKafkaConsumer: BooksKafkaConsumer;
	let imageReprocessingService: ImageReprocessingService;
	let adminToken: string;

	const createdBookIds: string[] = [];

	beforeAll(async () => {
		app = await createE2EApp();
		dataSource = app.get(DataSource);
		redisService = app.get(RedisService);
		handleImageProcessingUseCase = app.get(
			HandleImageProcessingCompletedUseCase,
		);
		booksKafkaConsumer = app.get(BooksKafkaConsumer);
		imageReprocessingService = app.get(ImageReprocessingService);

		// Setup Admin user
		const authService = app.get(AuthService);
		try {
			await authService.signUp(ADMIN_EMAIL, ADMIN_PASSWORD, true);
		} catch (error) {
			if (!(error instanceof BadRequestException)) {
				throw error;
			}
		}

		const adminResponse = await request(app.getHttpServer())
			.post('/api/auth/signin')
			.set('x-client-platform', 'web')
			.set('x-device-id', `admin-${uuidv7()}`)
			.send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

		adminToken = extractPayload<AuthResultPayload>(
			adminResponse.body,
		).accessToken;
	});

	afterAll(async () => {
		// Clean up created test entities
		if (dataSource && createdBookIds.length > 0) {
			const bookRepo = dataSource.getRepository(Book);
			await bookRepo.delete(createdBookIds);
		}

		if (app) {
			await app.close();
		}
	});

	/**
	 * Helper para criar um livro com capa no banco de dados para testes
	 */
	async function createTestBook(coverData: Partial<Cover>): Promise<{
		book: Book;
		cover: Cover;
	}> {
		const bookRepo = dataSource.getRepository(Book);
		const coverRepo = dataSource.getRepository(Cover);

		const bookId = uuidv7();
		createdBookIds.push(bookId);

		const book = bookRepo.create({
			id: bookId,
			title: `Test Book Variants ${bookId.substring(0, 8)}`,
			originalLanguageCode: 'pt-BR',
			publicationStatus: PublicationStatus.ONGOING,
		});
		await bookRepo.save(book);

		const coverId = uuidv7();
		const cover = coverRepo.create({
			id: coverId,
			book: book,
			url:
				coverData.url ||
				`processing/${coverId.slice(-2)}/${coverId}.jpg`,
			title: 'Cover Image',
			index: 0,
			selected: true,
			originalUrl:
				coverData.originalUrl ||
				`https://example.com/cover-${coverId}.jpg`,
			scrapingStatus: coverData.scrapingStatus || ScrapingStatus.PROCESS,
			metadata: coverData.metadata || null,
			variants: coverData.variants || null,
		});
		const savedCover = await coverRepo.save(cover);

		return { book, cover: savedCover };
	}

	describe('1. Image Processing Completed Event with Variants', () => {
		it('should persist original WebP and all variant renditions in Cover entity', async () => {
			const { book, cover } = await createTestBook({
				url: 'processing/ab/test-cover-1.jpg',
				originalUrl: 'https://example.com/test-cover-1.jpg',
			});

			const rawPath = 'processing/ab/test-cover-1.jpg';
			const targetPath = 'ab/test-cover-1.webp';

			// Simulate file-processor image.processing.completed payload
			await handleImageProcessingUseCase.executeBatch([
				{
					rawPath,
					originalUrl: cover.originalUrl ?? undefined,
					targetBucket: 'books',
					results: [
						{
							targetPath: targetPath,
							kind: 'original',
							metadata: {
								width: 1200,
								height: 1800,
								sizeBytes: 120000,
								mimeType: 'image/webp',
								blurHash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
								dominantColor: '#1a1a1a',
								pHash: 'd41d8cd98f00b204e9800998ecf8427e',
							},
						},
						{
							targetPath: 'ab/test-cover-1_w600.webp',
							kind: 'variant',
							metadata: {
								width: 600,
								height: 900,
								sizeBytes: 45000,
								mimeType: 'image/webp',
								blurHash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
								dominantColor: '#1a1a1a',
								pHash: 'd41d8cd98f00b204e9800998ecf8427e',
							},
						},
						{
							targetPath: 'ab/test-cover-1_w300.webp',
							kind: 'variant',
							metadata: {
								width: 300,
								height: 450,
								sizeBytes: 18000,
								mimeType: 'image/webp',
								blurHash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
								dominantColor: '#1a1a1a',
								pHash: 'd41d8cd98f00b204e9800998ecf8427e',
							},
						},
					],
				},
			]);

			// Verify in Database with force_master comment
			const coverRepo = dataSource.getRepository(Cover);
			const updatedCover = await coverRepo.findOne({
				where: { id: cover.id },
				comment: 'force_master',
			});

			expect(updatedCover).toBeDefined();
			expect(updatedCover?.url).toBe('ab/test-cover-1.webp');
			expect(updatedCover?.metadata?.width).toBe(1200);
			expect(updatedCover?.variants).toHaveLength(2);
			expect(updatedCover?.variants).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						width: 600,
						path: 'ab/test-cover-1_w600.webp',
					}),
					expect.objectContaining({
						width: 300,
						path: 'ab/test-cover-1_w300.webp',
					}),
				]),
			);

			// Verify cached in Redis for fast-path optimization
			const redis = redisService.getClient();
			const cached = await redis.get(
				'pending_optimization:processing/ab/test-cover-1.jpg',
			);
			expect(cached).toBeDefined();
			const parsedCache = JSON.parse(cached ?? '{}');
			expect(parsedCache.path).toBe('ab/test-cover-1.webp');
			expect(parsedCache.variants).toHaveLength(2);
		});
	});

	describe('2. Resolution serving: List view (smallest variant) vs Details view (original)', () => {
		it('should serve the smallest variant (300w) in GET /api/books listing to reduce network/memory payload', async () => {
			const { book, cover } = await createTestBook({
				url: 'cd/test-cover-2.webp',
				scrapingStatus: ScrapingStatus.READY,
				metadata: {
					width: 1200,
					height: 1800,
					sizeBytes: 150000,
					mimeType: 'image/webp',
				},
				variants: [
					{
						width: 600,
						path: 'cd/test-cover-2_w600.webp',
						metadata: {
							width: 600,
							height: 900,
							sizeBytes: 50000,
							mimeType: 'image/webp',
						},
					},
					{
						width: 300,
						path: 'cd/test-cover-2_w300.webp',
						metadata: {
							width: 300,
							height: 450,
							sizeBytes: 20000,
							mimeType: 'image/webp',
						},
					},
				],
			});

			const response = await request(app.getHttpServer())
				.get(`/api/books?ids=${book.id}`)
				.expect(200);

			const payload = extractPayload<any>(response.body);
			const books = Array.isArray(payload) ? payload : payload.data;
			const bookInList = books?.find((b: any) => b.id === book.id);

			expect(bookInList).toBeDefined();
			// List view MUST serve the smallest variant
			expect(bookInList?.cover).toContain('cd/test-cover-2_w300.webp');
			expect(bookInList?.coverMetadata?.width).toBe(300);
		});

		it('should serve the full resolution original cover in GET /api/books/:id details', async () => {
			const { book, cover } = await createTestBook({
				url: 'cd/test-cover-3.webp',
				scrapingStatus: ScrapingStatus.READY,
				metadata: {
					width: 1200,
					height: 1800,
					sizeBytes: 150000,
					mimeType: 'image/webp',
				},
				variants: [
					{
						width: 600,
						path: 'cd/test-cover-3_w600.webp',
					},
					{
						width: 300,
						path: 'cd/test-cover-3_w300.webp',
					},
				],
			});

			const response = await request(app.getHttpServer())
				.get(`/api/books/${book.id}`)
				.expect(200);

			const bookDetails = extractPayload<{
				cover: string;
				coverMetadata: any;
			}>(response.body);

			// Details view MUST serve the full original cover
			expect(bookDetails.cover).toContain('cd/test-cover-3.webp');
			expect(bookDetails.cover).not.toContain('_w300.webp');
			expect(bookDetails.coverMetadata?.width).toBe(1200);
		});
	});

	describe('3. Scraper Kafka Consumer Race Condition (pending_optimization via Redis)', () => {
		it('should consume scraping.covers.completed and apply variants cached from image.processing.completed', async () => {
			const { book, cover } = await createTestBook({
				url: 'processing/ef/test-cover-4.jpg',
				originalUrl: 'https://example.com/test-cover-4.jpg',
				scrapingStatus: ScrapingStatus.PROCESS,
			});

			// Pre-fill Redis cache as if image.processing.completed arrived just before scraping.covers.completed
			const redis = redisService.getClient();
			await redis.set(
				'pending_optimization:processing/ef/test-cover-4.jpg',
				JSON.stringify({
					path: 'ef/test-cover-4.webp',
					metadata: { width: 1000, height: 1500, pHash: 'hash-abc' },
					variants: [
						{ width: 600, path: 'ef/test-cover-4_w600.webp' },
						{ width: 300, path: 'ef/test-cover-4_w300.webp' },
					],
				}),
				'EX',
				3600,
			);

			// Trigger handleCoversScrapingCompleted with Kafka payload
			await booksKafkaConsumer.handleCoversScrapingCompleted([
				{
					value: Buffer.from(
						JSON.stringify({
							jobId: 'job-123',
							bookId: book.id,
							results: [
								{
									originalUrl: cover.originalUrl,
									path: 'processing/ef/test-cover-4.jpg',
								},
							],
						}),
					),
				} as any,
			]);

			// Verify cover in DB is ready and has resolved variants and WebP path
			const coverRepo = dataSource.getRepository(Cover);
			const updated = await coverRepo.findOne({
				where: { id: cover.id },
				comment: 'force_master',
			});

			expect(updated).toBeDefined();
			expect(updated?.scrapingStatus).toBe(ScrapingStatus.READY);
			expect(updated?.url).toBe('ef/test-cover-4.webp');
			expect(updated?.variants).toHaveLength(2);
			expect(updated?.variants?.[1].width).toBe(300);
		});
	});

	describe('4. Image Reprocessing Flow (Manual Admin & Backfill)', () => {
		it('should allow Admin to request immediate reprocessing of a cover via POST /api/admin/images/covers/:id/reprocess', async () => {
			const { book, cover } = await createTestBook({
				url: 'gh/legacy-cover.webp',
				scrapingStatus: ScrapingStatus.READY,
				metadata: { width: 800, height: 1200, pHash: 'p-123' },
				variants: null, // Legacy cover without variants
			});

			const response = await request(app.getHttpServer())
				.post(`/api/admin/images/covers/${cover.id}/reprocess`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(202);

			expect(response.body).toEqual({
				message: `Reprocessing requested for cover ${cover.id}.`,
			});
		});

		it('should identify outdated covers missing variants in reprocessAll() scan', async () => {
			const { book, cover } = await createTestBook({
				url: 'ij/outdated-cover.webp',
				scrapingStatus: ScrapingStatus.READY,
				metadata: { width: 1000, height: 1500, pHash: 'hash-xyz' },
				variants: null, // Missing variants!
			});

			const result = await imageReprocessingService.reprocessAll();
			expect(result.totalRequested).toBeGreaterThanOrEqual(1);
		});
	});
});
