import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureValidationPipe } from '../src/infrastructure/http/config/validation-pipe.config';
import cookieParser from 'cookie-parser';
import { KafkaEventPublisherAdapter } from '../src/files/infrastructure/adapters/kafka-event-publisher.adapter';

describe('GraphQL BFF (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const mockEventPublisher = {
			publishImageProcessingRequest: jest
				.fn()
				.mockResolvedValue(undefined),
			onModuleInit: jest.fn().mockResolvedValue(undefined),
			onModuleDestroy: jest.fn().mockResolvedValue(undefined),
		};

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider('EVENT_PUBLISHER_PORT')
			.useValue(mockEventPublisher)
			.overrideProvider(KafkaEventPublisherAdapter)
			.useValue(mockEventPublisher)
			.compile();

		app = moduleFixture.createNestApplication();
		app.setGlobalPrefix('api');
		configureValidationPipe(app);
		app.use(cookieParser());
		await app.init();
	}, 60000);

	afterAll(async () => {
		if (app) {
			await app.close();
		}
	});

	it('should list books through GraphQL', async () => {
		const query = `
      query {
        books(filter: { limit: 5 }) {
          data {
            id
            title
          }
          total
        }
      }
    `;

		const response = await request(app.getHttpServer())
			.post('/api/graphql')
			.send({ query });

		expect(response.status).toBe(200);
		expect(response.body.data).toBeDefined();
		if (response.body.data) {
			expect(Array.isArray(response.body.data.books.data)).toBe(true);
		}
	});

	it('should return errors for invalid queries', async () => {
		const query = `
      query {
        invalidField
      }
    `;

		const response = await request(app.getHttpServer())
			.post('/api/graphql')
			.send({ query });

		expect(response.body.errors).toBeDefined();
	});

	it('should require authentication for sync mutation', async () => {
		const query = `
      mutation {
        sync(input: { lastSyncAt: "2026-04-26T00:00:00Z" }) {
          syncedAt
        }
      }
    `;

		const response = await request(app.getHttpServer())
			.post('/api/graphql')
			.send({ query });

		// Should be 200 with error message because of GqlJwtAuthGuard returning unauthorized inside GraphQL context
		expect(response.status).toBe(200);
		expect(response.body.errors).toBeDefined();
		expect(response.body.errors[0].message).toBe('Unauthorized');
	});
});
