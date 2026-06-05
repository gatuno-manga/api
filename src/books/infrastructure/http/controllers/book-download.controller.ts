import { DownloadBookBodyDto } from '@books/application/dto/download-book-body.dto';
import { DownloadBookQueryDto } from '@books/application/dto/download-book-query.dto';
import { DownloadService } from '@books/application/services/download.service';
import {
	Body,
	Controller,
	Get,
	Logger,
	Param,
	Post,
	Query,
	Res,
	StreamableFile,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import {
	ApiDocsDownloadBook,
	ApiDocsDownloadBookGet,
} from './swagger/book-download.swagger';

@ApiTags('Downloads')
@Controller('books')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class BookDownloadController {
	private readonly logger = new Logger(BookDownloadController.name);

	constructor(private readonly downloadService: DownloadService) {}

	@Get(':idBook/download')
	@Permissions(PermissionsEnum.BOOKS_DOWNLOAD)
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
	@Permissions(PermissionsEnum.BOOKS_DOWNLOAD)
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
