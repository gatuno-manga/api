import { Controller, Post, UseGuards } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import { ImageMetadataBackfillService } from '../../application/services/image-metadata-backfill.service';

@ApiTags('Admin - Image Backfill')
@Controller('admin/images')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class ImageBackfillController {
	constructor(
		private readonly backfillService: ImageMetadataBackfillService,
	) {}

	@Post('backfill')
	@ApiOperation({
		summary: 'Backfill image metadata',
		description:
			'Scan for images without pHash metadata and request processing (Admin only)',
	})
	@ApiResponse({
		status: 202,
		description: 'Backfill process started successfully',
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Admin role required',
	})
	async backfill() {
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
