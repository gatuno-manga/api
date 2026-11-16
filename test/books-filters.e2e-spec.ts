import { BookOrderField } from '@books/domain/enums/book-order-field.enum';
import { BookType } from '@books/domain/enums/book-type.enum';
import { INestApplication } from '@nestjs/common';
import { FilterLogic } from 'src/common/enum/filter-logic.enum';
import { FilterOperator } from 'src/common/enum/filter-operator.enum';
import { OrderDirection } from 'src/common/enum/order-direction.enum';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
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
			expect(response.body).toHaveProperty('metadata');
			expect(Array.isArray(response.body.data)).toBeTruthy();
		});

		it('should filter books by type', async () => {
			const response = await request(app.getHttpServer())
				.get(`/api/books?type=${BookType.MANGA}`)
				.expect(200);

			expect(response.body).toHaveProperty('data');
			if (response.body.data.length > 0) {
				expect(response.body.data[0].type).toBe(BookType.MANGA);
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
				.get(
					`/api/books?publication=2020&publicationOperator=${FilterOperator.GTE}`,
				)
				.expect(200);

			expect(response.body).toHaveProperty('data');
		});

		it('should filter books by specific tags logic', async () => {
			// Usando IDs fictícios (UUIDs) para testar a camada de validação (DTO e Filters)
			const mockTagId = uuidv7();
			const response = await request(app.getHttpServer())
				.get(
					`/api/books?tags=${mockTagId}&tagsLogic=${FilterLogic.AND}`,
				)
				.expect(200);

			expect(response.body).toHaveProperty('data');
		});

		it('should combine multiple filters safely (search, tags, types, order)', async () => {
			const query = new URLSearchParams({
				search: 'Naruto',
				type: BookType.MANGA,
				tagsLogic: FilterLogic.AND,
				excludeTagsLogic: FilterLogic.OR,
				orderBy: BookOrderField.CREATED_AT,
				order: OrderDirection.DESC,
				limit: '10',
				page: '1',
			});

			const response = await request(app.getHttpServer())
				.get(`/api/books?${query.toString()}`)
				.expect(200);

			expect(response.body).toHaveProperty('data');
			// The page metadata has no `limit`; the limit shows in the page size.
			expect(response.body.metadata).toEqual(
				expect.objectContaining({
					page: 1,
					total: expect.any(Number),
					lastPage: expect.any(Number),
				}),
			);
			expect(response.body.data.length).toBeLessThanOrEqual(10);
		});
	});
});
