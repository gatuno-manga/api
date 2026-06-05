import { ImageMetadataBackfillService } from '@files/application/services/image-metadata-backfill.service';
import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import { ApiDocsBackfill } from './swagger/image-backfill.swagger';

import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';

@ApiTags('Admin - Image Backfill')
@Controller('admin/images')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(PermissionsEnum.FILES_MANAGE)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class ImageBackfillController {
	constructor(
		private readonly backfillService: ImageMetadataBackfillService,
	) {}

	@Post('backfill')
	@ApiDocsBackfill()
	backfill() {
		// Inicia em background para não travar a requisição HTTP
		this.backfillService.backfill().catch((err) => {
			console.error('Error during image backfill background job:', err);
		});

		return {
			message:
				'Image metadata backfill process started. Check logs for progress.',
		};
	}
}
