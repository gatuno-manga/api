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
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AdminApi } from 'src/common/swagger/auth-api.decorators';
import {
	ALLOWED_DOCUMENT_MIMETYPES,
	MAX_DOCUMENT_SIZE,
} from '@books/domain/constants/content-types.constants';
import { UploadCoverDto } from '@books/application/dto/upload-cover.dto';
import { UploadTextContentDto } from '@books/application/dto/upload-text-content.dto';
import { BookUploadService } from '@books/application/services/book-upload.service';
import {
	ApiDocsReplaceCoverImage,
	ApiDocsUploadCover,
	ApiDocsUploadMultipleCovers,
	ApiDocsUploadChapterPages,
	ApiDocsUploadChapterDocument,
	ApiDocsUploadChapterTextContent,
} from './swagger/admin-books-upload.swagger';

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
	@UseInterceptors(
		FileInterceptor('file', {
			limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
			fileFilter: IMAGE_FILE_FILTER,
		}),
	)
	@ApiDocsReplaceCoverImage()
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
	@UseInterceptors(
		FileInterceptor('file', {
			limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
			fileFilter: IMAGE_FILE_FILTER,
		}),
	)
	@ApiDocsUploadCover()
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
	@UseInterceptors(
		FilesInterceptor('files', 10, {
			limits: { fileSize: 10 * 1024 * 1024 },
			fileFilter: IMAGE_FILE_FILTER,
		}),
	)
	@ApiDocsUploadMultipleCovers()
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
	@UseInterceptors(
		FilesInterceptor('pages', 100, {
			limits: { fileSize: 10 * 1024 * 1024 },
			fileFilter: IMAGE_FILE_FILTER,
		}),
	)
	@ApiDocsUploadChapterPages()
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
	@ApiDocsUploadChapterDocument()
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
	@Throttle({ short: { limit: 10, ttl: 60000 } })
	@ApiDocsUploadChapterTextContent() // 10 req/min
	uploadChapterTextContent(
		@Param('idChapter') idChapter: string,
		@Body() dto: UploadTextContentDto,
	) {
		return this.bookUploadService.uploadChapterTextContent(idChapter, dto);
	}
}
