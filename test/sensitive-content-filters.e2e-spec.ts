import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BookRelationType } from 'src/books/domain/enums/book-relation-type.enum';
import { BookType } from 'src/books/domain/enums/book-type.enum';
import { ScrapingStatus } from 'src/books/domain/enums/scrapingStatus.enum';
import { BookRelationship } from 'src/books/infrastructure/database/entities/book-relationship.entity';
import { Book } from 'src/books/infrastructure/database/entities/book.entity';
import { SensitiveContent } from 'src/books/infrastructure/database/entities/sensitive-content.entity';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { createE2EApp } from './helpers/e2e-app.helper';

jest.setTimeout(120000);

describe('Sensitive Content Filters (e2e)', () => {
	let app: INestApplication;
	let dataSource: DataSource;

	let safeBookId: string;
	let adultBookId: string;
	let adultContentId: string;

	function createTestToken(maxWeight: number): string {
		const jwtService = app.get(JwtService);
		const configService = app.get(AppConfigService);

		return jwtService.sign(
			{
				sub: uuidv7(),
				email: 'test-user@gatuno.local',
				roles: ['user'],
				maxWeightSensitiveContent: maxWeight,
				sessionId: uuidv7(),
			},
			{
				issuer: configService.jwt.issuer,
				audience: configService.jwt.audience,
				expiresIn: '5m',
			},
		);
	}

	beforeAll(async () => {
		app = await createE2EApp();
		dataSource = app.get(DataSource);

		const scRepo = dataSource.getRepository(SensitiveContent);
		const bookRepo = dataSource.getRepository(Book);
		const relRepo = dataSource.getRepository(BookRelationship);

		// Create a sensitive content tag for "Adult" with weight 99
		const sc = scRepo.create({
			id: uuidv7(),
			name: 'E2E Adult Content',
			weight: 99,
		});
		await scRepo.save(sc);
		adultContentId = sc.id;

		// Create a Safe Book
		const safeBook = bookRepo.create({
			id: uuidv7(),
			title: 'E2E Safe Book',
			type: BookType.BOOK,
			scrapingStatus: ScrapingStatus.READY,
		});
		await bookRepo.save(safeBook);
		safeBookId = safeBook.id;

		// Create an Adult Book
		const adultBook = bookRepo.create({
			id: uuidv7(),
			title: 'E2E Adult Book',
			type: BookType.BOOK,
			scrapingStatus: ScrapingStatus.READY,
			sensitiveContent: [sc],
		});
		await bookRepo.save(adultBook);
		adultBookId = adultBook.id;

		// Create a relationship between the Safe Book and Adult Book
		const rel = relRepo.create({
			id: uuidv7(),
			sourceBookId: safeBook.id,
			targetBookId: adultBook.id,
			relationType: BookRelationType.SPIN_OFF,
			isBidirectional: true,
		});
		await relRepo.save(rel);
	});

	afterAll(async () => {
		const scRepo = dataSource.getRepository(SensitiveContent);
		const bookRepo = dataSource.getRepository(Book);
		const relRepo = dataSource.getRepository(BookRelationship);

		// Clean up
		await relRepo.delete({ sourceBookId: safeBookId });
		await bookRepo.delete([safeBookId, adultBookId]);
		await scRepo.delete(adultContentId);

		await app.close();
	});

	describe('GET /api/books', () => {
		it('should list safe book and filter adult book for minor user (maxWeight 10)', async () => {
			const minorToken = createTestToken(10);
			const response = await request(app.getHttpServer())
				.get('/api/books')
				.set('Authorization', `Bearer ${minorToken}`)
				.expect(200);

			const books = response.body.data || response.body.items || [];

			// Deve conter o safeBookId
			const hasSafeBook = books.some((b: any) => b.id === safeBookId);
			expect(hasSafeBook).toBe(true);

			// NÃO deve conter o adultBookId
			const hasAdultBook = books.some((b: any) => b.id === adultBookId);
			expect(hasAdultBook).toBe(false);
		});

		it('should list both safe book and adult book for adult user (maxWeight 100)', async () => {
			const adultToken = createTestToken(100);
			const response = await request(app.getHttpServer())
				.get('/api/books')
				.set('Authorization', `Bearer ${adultToken}`)
				.expect(200);

			const books = response.body.data || response.body.items || [];

			const hasSafeBook = books.some((b: any) => b.id === safeBookId);
			expect(hasSafeBook).toBe(true);

			const hasAdultBook = books.some((b: any) => b.id === adultBookId);
			expect(hasAdultBook).toBe(true);
		});
	});

	describe('GET /api/books/:idBook/relationships', () => {
		it('should not list adult related book for minor user (maxWeight 10)', async () => {
			const minorToken = createTestToken(10);
			const response = await request(app.getHttpServer())
				.get(`/api/books/${safeBookId}/relationships`)
				.set('Authorization', `Bearer ${minorToken}`)
				.expect(200);

			const relationships =
				response.body.data || response.body.items || [];

			// A relação com adultBookId deve ser filtrada
			const hasAdultRelation = relationships.some(
				(r: any) => r.relatedBook?.id === adultBookId,
			);
			expect(hasAdultRelation).toBe(false);
		});

		it('should list adult related book for adult user (maxWeight 100)', async () => {
			const adultToken = createTestToken(100);
			const response = await request(app.getHttpServer())
				.get(`/api/books/${safeBookId}/relationships`)
				.set('Authorization', `Bearer ${adultToken}`)
				.expect(200);

			const relationships =
				response.body.data || response.body.items || [];

			// A relação com adultBookId deve aparecer
			const hasAdultRelation = relationships.some(
				(r: any) => r.relatedBook?.id === adultBookId,
			);
			expect(hasAdultRelation).toBe(true);
		});
	});
});
