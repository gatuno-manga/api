import {
	BadRequestException,
	Body,
	Controller,
	Param,
	Patch,
	Post,
	UploadedFile,
	UploadedFiles,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
	ApiBody,
	ApiConsumes,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AdminApi } from 'src/common/swagger/auth-api.decorators';
import { COMMON_RESPONSES } from 'src/common/swagger/common-responses';
import { MULTIPART_SCHEMAS } from 'src/common/swagger/multipart-schemas';
import {
	ALLOWED_DOCUMENT_MIMETYPES,
	MAX_DOCUMENT_SIZE,
} from './constants/content-types.constants';
import { UploadCoverDto } from './dto/upload-cover.dto';
import { UploadTextContentDto } from './dto/upload-text-content.dto';
import { BookUploadService } from './services/book-upload.service';

const IMAGE_FILE_FILTER = (
	req: Request,
	file: Express.Multer.File,
	callback: (error: Error | null, acceptFile: boolean) => void,
) => {
	if (!file.mimetype.match(/^image\//)) {
		return callback(
			new BadRequestException('Only image files are allowed'),
			false,
		);
	}
	callback(null, true);
};

@ApiTags('Books Admin Upload')
@Controller('books')
@AdminApi()
export class AdminBooksUploadController {
	constructor(private readonly bookUploadService: BookUploadService) {}

	@Patch(':idBook/covers/:idCover/image')
	@Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 req/min
	@ApiOperation({
		summary: 'Substituir imagem da capa',
		description: 'Substitui a imagem de uma capa existente (somente admin)',
	})
	@ApiConsumes('multipart/form-data')
	@ApiParam({
		name: 'idBook',
		description: 'Identificador unico do livro',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiParam({
		name: 'idCover',
		description: 'Identificador unico da capa',
		example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
	})
	@ApiBody({
		schema: MULTIPART_SCHEMAS.IMAGE_FILE_WITH_OPTIONAL_TITLE,
	})
	@ApiResponse({
		status: 200,
		description: 'Imagem da capa substituida com sucesso',
	})
	@ApiResponse(COMMON_RESPONSES.BAD_REQUEST)
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@UseInterceptors(
		FileInterceptor('file', {
			limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
			fileFilter: IMAGE_FILE_FILTER,
		}),
	)
	replaceCoverImage(
		@Param('idBook') idBook: string,
		@Param('idCover') idCover: string,
		@UploadedFile() file: Express.Multer.File,
		@Body() dto: UploadCoverDto,
	) {
		if (!file) {
			throw new BadRequestException('No file provided');
		}
		return this.bookUploadService.replaceCoverImage(
			idBook,
			idCover,
			file,
			dto.title,
		);
	}

	// ==================== UPLOAD ENDPOINTS ====================

	@Post(':idBook/covers/upload')
	@Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 req/min
	@ApiOperation({
		summary: 'Enviar capa do livro',
		description:
			'Envia uma unica imagem de capa para um livro (somente admin)',
	})
	@ApiConsumes('multipart/form-data')
	@ApiParam({
		name: 'idBook',
		description: 'Identificador unico do livro',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiBody({
		schema: MULTIPART_SCHEMAS.IMAGE_FILE_WITH_OPTIONAL_TITLE,
	})
	@ApiResponse({ status: 201, description: 'Capa enviada com sucesso' })
	@ApiResponse(COMMON_RESPONSES.BAD_REQUEST)
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@UseInterceptors(
		FileInterceptor('file', {
			limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
			fileFilter: IMAGE_FILE_FILTER,
		}),
	)
	uploadCover(
		@Param('idBook') idBook: string,
		@UploadedFile() file: Express.Multer.File,
		@Body() dto: UploadCoverDto,
	) {
		if (!file) {
			throw new BadRequestException('No file provided');
		}
		return this.bookUploadService.uploadCover(idBook, file, dto.title);
	}

	@Post(':idBook/covers/upload-multiple')
	@Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 req/min
	@ApiOperation({
		summary: 'Enviar multiplas capas do livro',
		description: 'Envia varias imagens de capa de uma vez (somente admin)',
	})
	@ApiConsumes('multipart/form-data')
	@ApiParam({
		name: 'idBook',
		description: 'Identificador unico do livro',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiBody({
		schema: MULTIPART_SCHEMAS.MULTIPLE_IMAGE_FILES,
	})
	@ApiResponse({ status: 201, description: 'Capas enviadas com sucesso' })
	@ApiResponse(COMMON_RESPONSES.BAD_REQUEST)
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@UseInterceptors(
		FilesInterceptor('files', 10, {
			limits: { fileSize: 10 * 1024 * 1024 },
			fileFilter: IMAGE_FILE_FILTER,
		}),
	)
	uploadMultipleCovers(
		@Param('idBook') idBook: string,
		@UploadedFiles() files: Express.Multer.File[],
	) {
		if (!files || files.length === 0) {
			throw new BadRequestException('No files provided');
		}
		return this.bookUploadService.uploadMultipleCovers(idBook, files);
	}

	@Post('chapters/:idChapter/pages/upload')
	@Throttle({ short: { limit: 2, ttl: 60000 } }) // 2 req/min - até 100 arquivos por vez
	@ApiOperation({
		summary: 'Enviar paginas do capitulo',
		description:
			'Envia varias imagens de pagina para um capitulo (somente admin)',
	})
	@ApiConsumes('multipart/form-data')
	@ApiParam({
		name: 'idChapter',
		description: 'Identificador unico do capitulo',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiBody({
		schema: MULTIPART_SCHEMAS.CHAPTER_PAGES_UPLOAD,
	})
	@ApiResponse({ status: 201, description: 'Paginas enviadas com sucesso' })
	@ApiResponse(COMMON_RESPONSES.BAD_REQUEST)
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@UseInterceptors(
		FilesInterceptor('pages', 100, {
			limits: { fileSize: 10 * 1024 * 1024 },
			fileFilter: IMAGE_FILE_FILTER,
		}),
	)
	uploadChapterPages(
		@Param('idChapter') idChapter: string,
		@UploadedFiles() files: Express.Multer.File[],
		@Body('indices') indicesStr: string,
	) {
		if (!files || files.length === 0) {
			throw new BadRequestException('No files provided');
		}

		if (!indicesStr) {
			throw new BadRequestException('Indices are required');
		}

		const indices = this.parseIndices(indicesStr);

		if (!Array.isArray(indices)) {
			throw new BadRequestException('Indices must be an array');
		}

		return this.bookUploadService.uploadChapterPages(
			idChapter,
			files,
			indices,
		);
	}

	private parseIndices(indicesStr: string): number[] {
		try {
			const parsed: unknown = JSON.parse(indicesStr);
			if (!Array.isArray(parsed)) {
				throw new BadRequestException('Indices must be an array');
			}
			if (!parsed.every((value) => typeof value === 'number')) {
				throw new BadRequestException(
					'Indices must contain only numbers',
				);
			}
			return parsed;
		} catch {
			throw new BadRequestException(
				'Invalid indices format. Must be a JSON array of numbers',
			);
		}
	}

	// ==================== UPLOAD DE DOCUMENTOS (PDF/EPUB) ====================

	@Post('chapters/:idChapter/document')
	@Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 req/min
	@ApiOperation({
		summary: 'Enviar documento do capitulo',
		description:
			'Envia um documento PDF ou EPUB para um capitulo (somente admin)',
	})
	@ApiConsumes('multipart/form-data')
	@ApiParam({
		name: 'idChapter',
		description: 'Identificador unico do capitulo',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiBody({
		schema: MULTIPART_SCHEMAS.DOCUMENT_FILE_WITH_OPTIONAL_TITLE,
	})
	@ApiResponse({
		status: 201,
		description: 'Documento enviado com sucesso',
	})
	@ApiResponse(COMMON_RESPONSES.BAD_REQUEST)
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@UseInterceptors(
		FileInterceptor('file', {
			limits: { fileSize: MAX_DOCUMENT_SIZE },
			fileFilter: (req, file, callback) => {
				if (!ALLOWED_DOCUMENT_MIMETYPES.includes(file.mimetype)) {
					return callback(
						new BadRequestException(
							'Only PDF and EPUB files are allowed',
						),
						false,
					);
				}
				callback(null, true);
			},
		}),
	)
	uploadChapterDocument(
		@Param('idChapter') idChapter: string,
		@UploadedFile() file: Express.Multer.File,
		@Body('title') title?: string,
	) {
		if (!file) {
			throw new BadRequestException('No file provided');
		}

		return this.bookUploadService.uploadChapterDocument(
			idChapter,
			file,
			title,
		);
	}

	// ==================== UPLOAD DE CONTEÚDO TEXTUAL ====================

	@Post('chapters/:idChapter/content')
	@Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 req/min
	@ApiOperation({
		summary: 'Enviar conteudo textual do capitulo',
		description:
			'Envia conteudo textual (Markdown/HTML/Plain) para um capitulo (somente admin)',
	})
	@ApiParam({
		name: 'idChapter',
		description: 'Identificador unico do capitulo',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiBody({
		type: UploadTextContentDto,
		description: 'Conteudo textual e formato',
	})
	@ApiResponse({
		status: 201,
		description: 'Conteudo textual enviado com sucesso',
	})
	@ApiResponse(COMMON_RESPONSES.BAD_REQUEST)
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	uploadChapterTextContent(
		@Param('idChapter') idChapter: string,
		@Body() dto: UploadTextContentDto,
	) {
		return this.bookUploadService.uploadChapterTextContent(idChapter, dto);
	}
}
