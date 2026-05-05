import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import { ImageMetadataBackfillService } from '../../application/services/image-metadata-backfill.service';
import { ApiDocsBackfill } from './swagger/image-backfill.swagger';

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
	@ApiDocsBackfill()
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
