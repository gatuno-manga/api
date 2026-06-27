import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2EApp } from './helpers/e2e-app.helper';

jest.setTimeout(120000);

describe('Books Filters (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		app = await createE2EApp();
	});

	afterAll(async () => {
		if (app) {
			await app.close();
		}
	});

	describe('GET /books', () => {
		it('should return a list of books with default parameters (200 OK)', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/books')
				.expect(200);

			expect(response.body).toHaveProperty('data');
			expect(response.body).toHaveProperty('meta');
			expect(Array.isArray(response.body.data)).toBeTruthy();
		});

		it('should filter books by type', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/books?type=MANGA')
				.expect(200);

			expect(response.body).toHaveProperty('data');
			if (response.body.data.length > 0) {
				expect(response.body.data[0].type).toBe('MANGA');
			}
		});

		it('should accept search queries including alternative titles logic', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/books?search=SomeAlternativeTranslationText')
				.expect(200);

			expect(response.body).toHaveProperty('data');
		});

		it('should filter books by publication year', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/books?publication=2020&publicationOperator=GTE')
				.expect(200);

			expect(response.body).toHaveProperty('data');
		});

		it('should filter books by specific tags logic', async () => {
			// Usando IDs fictícios (UUIDs) para testar a camada de validação (DTO e Filters)
			const mockTagId = '00000000-0000-0000-0000-000000000001';
			const response = await request(app.getHttpServer())
				.get(`/api/books?tags=${mockTagId}&tagsLogic=AND`)
				.expect(200);

			expect(response.body).toHaveProperty('data');
		});

		it('should combine multiple filters safely (search, tags, types, order)', async () => {
			const query = new URLSearchParams({
				search: 'Naruto',
				type: 'MANGA',
				tagsLogic: 'AND',
				excludeTagsLogic: 'OR',
				orderBy: 'CREATED_AT',
				order: 'DESC',
				limit: '10',
				page: '1',
			});

			const response = await request(app.getHttpServer())
				.get(`/api/books?${query.toString()}`)
				.expect(200);

			expect(response.body).toHaveProperty('data');
			expect(response.body.meta.page).toBe(1);
			expect(response.body.meta.limit).toBe(10);
		});
	});
});
