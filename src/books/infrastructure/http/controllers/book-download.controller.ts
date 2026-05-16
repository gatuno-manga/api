import {
	Body,
	Controller,
	Logger,
	Param,
	Post,
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
import { DownloadBookBodyDto } from '@books/application/dto/download-book-body.dto';
import { DownloadBookQueryDto } from '@books/application/dto/download-book-query.dto';
import { Get, Query } from '@nestjs/common';
import {
	ApiDocsDownloadBookGet,
	ApiDocsDownloadBook,
} from './swagger/book-download.swagger';

@ApiTags('Downloads')
@Controller('books')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class BookDownloadController {
	private readonly logger = new Logger(BookDownloadController.name);

	constructor(private readonly downloadService: DownloadService) {}

	@Get(':idBook/download')
	@Throttle({ default: { limit: 3, ttl: 120000 } })
	@ApiDocsDownloadBookGet()
	async downloadBookGet(
		@Param('idBook') idBook: string,
		@Query() query: DownloadBookQueryDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<StreamableFile> {
		this.logger.log(`GET Download request for book ${idBook}`);

		const { file, fileName, contentType } =
			await this.downloadService.downloadBook(idBook, {
				format: query.format,
				chapterIds: query.chapterIds,
			});

		// Definir headers para download
		res.set({
			'Content-Type': contentType,
			'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
			'Cache-Control': 'no-cache',
		});

		this.logger.log(`Sending file: ${fileName} (${contentType})`);
		return file;
	}

	@Post(':idBook/download')
	@Throttle({ default: { limit: 3, ttl: 120000 } })
	@ApiDocsDownloadBook()
	async downloadBook(
		@Param('idBook') idBook: string,
		@Body() body: DownloadBookBodyDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<StreamableFile> {
		const chapterCount = body.chapterIds?.length ?? 'all';
		this.logger.log(
			`Download request for book ${idBook} with ${chapterCount} chapters`,
		);

		const { file, fileName, contentType } =
			await this.downloadService.downloadBook(idBook, body);

		// Definir headers para download
		res.set({
			'Content-Type': contentType,
			'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
			'Cache-Control': 'no-cache',
		});

		this.logger.log(`Sending file: ${fileName} (${contentType})`);
		return file;
	}
}
