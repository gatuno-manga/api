import { ImageReprocessingService } from '@files/application/services/image-reprocessing.service';
import {
	Controller,
	HttpCode,
	HttpStatus,
	Logger,
	NotFoundException,
	Param,
	Post,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import {
	ApiDocsBackfill,
	ApiDocsReprocessCover,
} from './swagger/image-backfill.swagger';

import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';

@ApiTags('Admin - Image Backfill')
@Controller('admin/images')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(PermissionsEnum.FILES_MANAGE)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class ImageBackfillController {
	private readonly logger = new Logger(ImageBackfillController.name);

	constructor(
		private readonly reprocessingService: ImageReprocessingService,
	) {}

	@Post('backfill')
	@HttpCode(HttpStatus.ACCEPTED)
	@ApiDocsBackfill()
	backfill() {
		// Inicia em background para não travar a requisição HTTP
		this.reprocessingService.reprocessAll().catch((err) => {
			this.logger.error('Error during image reprocessing scan:', err);
		});

		return {
			message:
				'Image reprocessing scan started. Check logs for progress.',
		};
	}

	@Post('covers/:id/reprocess')
	@HttpCode(HttpStatus.ACCEPTED)
	@ApiDocsReprocessCover()
	async reprocessCover(@Param('id') id: string) {
		const published = await this.reprocessingService.reprocessCoverById(id);

		if (!published) {
			throw new NotFoundException(
				`Cover ${id} not found or cannot be reprocessed`,
			);
		}

		return { message: `Reprocessing requested for cover ${id}.` };
	}
}
