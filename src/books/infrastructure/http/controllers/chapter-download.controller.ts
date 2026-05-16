import {
	Controller,
	Get,
	Logger,
	Param,
	Query,
	Res,
	StreamableFile,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { DownloadService } from '@books/application/services/download.service';
import { DownloadChapterQueryDto } from '@books/application/dto/download-chapter-query.dto';
import { ApiDocsDownloadChapter } from './swagger/chapter-download.swagger';

@ApiTags('Downloads')
@Controller('chapters')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class ChapterDownloadController {
	private readonly logger = new Logger(ChapterDownloadController.name);

	constructor(private readonly downloadService: DownloadService) {}

	@Get(':idChapter/download')
	@Throttle({ default: { limit: 5, ttl: 60000 } })
	@ApiDocsDownloadChapter()
	async downloadChapter(
		@Param('idChapter') idChapter: string,
		@Query() query: DownloadChapterQueryDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<StreamableFile> {
		this.logger.log(`Download request for chapter ${idChapter}`);

		const { file, fileName, contentType } =
			await this.downloadService.downloadChapter(idChapter, query);

		// Definir header Content-Disposition para download com nome correto
		res.set({
			'Content-Type': contentType,
			'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
		});

		this.logger.log(`Sending file: ${fileName} (${contentType})`);
		return file;
	}
}
