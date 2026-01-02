import {
    Controller,
    Get,
    Param,
    Query,
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
import { DownloadChapterQueryDto } from './dto/download-chapter-query.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Response } from 'express';

@ApiTags('Downloads')
@Controller('chapters')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ChapterDownloadController {
    private readonly logger = new Logger(ChapterDownloadController.name);

    constructor(private readonly downloadService: DownloadService) {}

    @Get(':idChapter/download')
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @ApiOperation({
        summary: 'Download de um capítulo',
        description:
            'Baixa um capítulo específico em formato ZIP (imagens) ou PDF',
    })
    @ApiParam({
        name: 'idChapter',
        description: 'ID do capítulo',
        type: 'string',
        format: 'uuid',
    })
    @ApiResponse({
        status: 200,
        description: 'Arquivo do capítulo gerado com sucesso',
        content: {
            'application/zip': {},
            'application/pdf': {},
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Capítulo não encontrado ou sem páginas',
    })
    @ApiResponse({
        status: 429,
        description: 'Limite de requisições excedido',
    })
    async downloadChapter(
        @Param('idChapter') idChapter: string,
        @Query() query: DownloadChapterQueryDto,
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        this.logger.log(`Download request for chapter ${idChapter}`);

        const { file, fileName } = await this.downloadService.downloadChapter(
            idChapter,
            query,
        );

        // Definir header Content-Disposition para download com nome correto
        res.set({
            'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        });

        this.logger.log(`Sending file: ${fileName}`);
        return file;
    }
}
