import { JwtAuthGuard } from '@auth/infrastructure/framework/jwt-auth.guard';
import { DomainException } from '@common/domain/exceptions/domain.exception';
import { ResourceNotFoundException } from '@common/domain/exceptions/resource-not-found.exception';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PermissionsGuard } from '@users/application/services/permissions.guard';
import { UserPreferencesService } from '@users/application/use-cases/user-preferences.service';
import { PERMISSIONS_KEY } from '@users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from '@users/domain/enums/permissions.enum';
import { configureValidationPipe } from 'src/infrastructure/http/config/validation-pipe.config';
import request from 'supertest';
import { UserPreferencesController } from './user-preferences.controller';

const USER_ID = '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

describe('UserPreferencesController (HTTP)', () => {
	let app: INestApplication;
	const service = {
		getPreferences: jest.fn(),
		getSection: jest.fn(),
		putSection: jest.fn(),
	};
	const authenticatedGuard = {
		canActivate: (context: ExecutionContext) => {
			context.switchToHttp().getRequest().user = { userId: USER_ID };
			return true;
		},
	};

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			controllers: [UserPreferencesController],
			providers: [{ provide: UserPreferencesService, useValue: service }],
		})
			.overrideGuard(JwtAuthGuard)
			.useValue(authenticatedGuard)
			.overrideGuard(PermissionsGuard)
			.useValue({ canActivate: () => true })
			.compile();

		app = moduleRef.createNestApplication();
		configureValidationPipe(app);
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		jest.resetAllMocks();
	});

	describe('permissions', () => {
		it.each([
			['getPreferences', PermissionsEnum.PROFILE_VIEW],
			['getSection', PermissionsEnum.PROFILE_VIEW],
			['putSection', PermissionsEnum.PROFILE_MANAGE],
		])('protects %s with %s', (handler, permission) => {
			// Act
			const permissions = Reflect.getMetadata(
				PERMISSIONS_KEY,
				UserPreferencesController.prototype[
					handler as keyof UserPreferencesController
				],
			);

			// Assert
			expect(permissions).toEqual([permission]);
		});
	});

	describe('GET /users/me/preferences', () => {
		it('returns every section of the current user in the data envelope', async () => {
			// Arrange
			service.getPreferences.mockResolvedValue({
				reader: { data: null, updatedAt: null },
			});

			// Act
			const response = await request(app.getHttpServer()).get(
				'/users/me/preferences',
			);

			// Assert
			expect(response.status).toBe(200);
			expect(response.body.data).toEqual({
				reader: { data: null, updatedAt: null },
			});
			expect(service.getPreferences).toHaveBeenCalledWith(USER_ID);
		});
	});

	describe('GET /users/me/preferences/:section', () => {
		it('returns the section of the current user', async () => {
			// Arrange
			service.getSection.mockResolvedValue({
				data: null,
				updatedAt: null,
			});

			// Act
			const response = await request(app.getHttpServer()).get(
				'/users/me/preferences/reader',
			);

			// Assert
			expect(response.status).toBe(200);
			expect(response.body.data).toEqual({ data: null, updatedAt: null });
			expect(service.getSection).toHaveBeenCalledWith(USER_ID, 'reader');
		});

		it('maps an unknown section to 404', async () => {
			// Arrange
			service.getSection.mockRejectedValue(
				new ResourceNotFoundException('Unknown preference section: x'),
			);

			// Act
			const response = await request(app.getHttpServer()).get(
				'/users/me/preferences/x',
			);

			// Assert
			expect(response.status).toBe(404);
		});
	});

	describe('PUT /users/me/preferences/:section', () => {
		const body = {
			data: { version: 1, fontSize: 19, fonts: ['serif', 'sans'] },
			updatedAt: '2026-11-14T12:00:00.000Z',
		};

		it('passes the opaque data and client timestamp through untouched', async () => {
			// Arrange
			service.putSection.mockResolvedValue(body);

			// Act
			const response = await request(app.getHttpServer())
				.put('/users/me/preferences/reader')
				.send(body);

			// Assert
			expect(response.status).toBe(200);
			expect(response.body.data).toEqual(body);
			expect(service.putSection).toHaveBeenCalledWith(
				USER_ID,
				'reader',
				body.data,
				new Date(body.updatedAt),
			);
		});

		it.each([
			['data is an array', { ...body, data: [1] }],
			['data is missing', { updatedAt: body.updatedAt }],
			['updatedAt is missing', { data: body.data }],
			['updatedAt is not ISO-8601', { ...body, updatedAt: 'yesterday' }],
			['an unknown field is sent', { ...body, extra: true }],
		])(
			'rejects the request with 400 when %s',
			async (_label, invalidBody) => {
				// Act
				const response = await request(app.getHttpServer())
					.put('/users/me/preferences/reader')
					.send(invalidBody);

				// Assert
				expect(response.status).toBe(400);
				expect(service.putSection).not.toHaveBeenCalled();
			},
		);

		it('maps domain rule violations (size cap, future timestamp) to 400', async () => {
			// Arrange
			service.putSection.mockRejectedValue(
				new DomainException('updatedAt must not be in the future'),
			);

			// Act
			const response = await request(app.getHttpServer())
				.put('/users/me/preferences/reader')
				.send(body);

			// Assert
			expect(response.status).toBe(400);
		});

		it('maps an unknown section to 404', async () => {
			// Arrange
			service.putSection.mockRejectedValue(
				new ResourceNotFoundException('Unknown preference section: x'),
			);

			// Act
			const response = await request(app.getHttpServer())
				.put('/users/me/preferences/x')
				.send(body);

			// Assert
			expect(response.status).toBe(404);
		});
	});
});
