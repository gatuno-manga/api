import { ImageReprocessingService } from '@files/application/services/image-reprocessing.service';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import request from 'supertest';
import { ImageBackfillController } from './image-backfill.controller';

describe('ImageBackfillController', () => {
	let app: INestApplication;
	let reprocessingServiceMock: {
		reprocessAll: jest.Mock;
		reprocessCoverById: jest.Mock;
	};

	beforeEach(async () => {
		reprocessingServiceMock = {
			reprocessAll: jest.fn().mockResolvedValue({ totalRequested: 0 }),
			reprocessCoverById: jest.fn().mockResolvedValue(true),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [ImageBackfillController],
			providers: [
				{
					provide: ImageReprocessingService,
					useValue: reprocessingServiceMock,
				},
			],
		})
			.overrideGuard(JwtAuthGuard)
			.useValue({ canActivate: () => true })
			.overrideGuard(PermissionsGuard)
			.useValue({ canActivate: () => true })
			.compile();

		app = module.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
	});

	it('answers 202 Accepted when the reprocessing scan is started', async () => {
		await request(app.getHttpServer())
			.post('/admin/images/backfill')
			.expect(HttpStatus.ACCEPTED);
	});

	it('answers 202 Accepted when a cover reprocessing is requested', async () => {
		await request(app.getHttpServer())
			.post('/admin/images/covers/cover-1/reprocess')
			.expect(HttpStatus.ACCEPTED);
	});

	it('answers 404 when the cover cannot be reprocessed', async () => {
		reprocessingServiceMock.reprocessCoverById.mockResolvedValue(false);

		await request(app.getHttpServer())
			.post('/admin/images/covers/missing/reprocess')
			.expect(HttpStatus.NOT_FOUND);
	});
});
