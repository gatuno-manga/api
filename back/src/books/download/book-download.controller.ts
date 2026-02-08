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
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { DownloadService } from './download.service';
import { DownloadBookBodyDto } from './dto/download-book-body.dto';

@ApiTags('Downloads')
@Controller('books')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class BookDownloadController {
	private readonly logger = new Logger(BookDownloadController.name);

	constructor(private readonly downloadService: DownloadService) {}

	@Post(':idBook/download')
	@Throttle({ default: { limit: 3, ttl: 120000 } })
	@ApiOperation({
		summary: 'Download de um livro',
		description:
			'Baixa capítulos selecionados de um livro em formato ZIP de imagens ou PDFs',
	})
	@ApiParam({
		name: 'idBook',
		description: 'ID do livro',
		type: 'string',
		format: 'uuid',
	})
	@ApiResponse({
		status: 200,
		description: 'Arquivo do livro gerado com sucesso',
		content: {
			'application/zip': {},
		},
	})
	@ApiResponse({
		status: 404,
		description: 'Livro não encontrado ou capítulos sem páginas',
	})
	@ApiResponse({
		status: 400,
		description: 'Dados inválidos na requisição',
	})
	@ApiResponse({
		status: 429,
		description: 'Limite de requisições excedido',
	})
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
