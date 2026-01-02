import {
    Controller,
    Post,
    Param,
    Body,
    UseGuards,
    StreamableFile,
    Logger,
    Res,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DownloadService } from './download.service';
import { DownloadBookBodyDto } from './dto/download-book-body.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Response } from 'express';

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

        const { file, fileName } = await this.downloadService.downloadBook(
            idBook,
            body,
        );

        // Definir header Content-Disposition para download com nome correto
        res.set({
            'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        });

        this.logger.log(`Sending file: ${fileName}`);
        return file;
    }
}
