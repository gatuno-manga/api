import {
	Body,
	Controller,
	Get,
	Patch,
	Post,
	UploadedFile,
	UploadedFiles,
	UseGuards,
	UseInterceptors,
	BadRequestException,
	Param,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
	ApiConsumes,
	ApiBody,
	ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UploadCoverDto } from './dto/upload-cover.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from 'src/users/enum/roles.enum';
import { BookUploadService } from './services/book-upload.service';

@ApiTags('Books Admin Upload')
@Controller('books')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
export class AdminBooksUploadController {
	constructor(
		private readonly bookUploadService: BookUploadService,
	) {}

	@Patch(':idBook/covers/:idCover/image')
	@Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 req/min
	@ApiOperation({
		summary: 'Replace cover image',
		description: 'Replace the image of an existing cover (Admin only)',
	})
	@ApiConsumes('multipart/form-data')
	@ApiParam({
		name: 'idBook',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiParam({
		name: 'idCover',
		description: 'Cover unique identifier',
		example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
	})
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				file: {
					type: 'string',
					format: 'binary',
					description: 'New cover image file (JPG, PNG, WEBP)',
				},
				title: {
					type: 'string',
					description: 'Optional new cover title',
					maxLength: 200,
				},
			},
			required: ['file'],
		},
	})
	@ApiResponse({
		status: 200,
		description: 'Cover image replaced successfully',
	})
	@ApiResponse({ status: 400, description: 'Invalid file or data' })
	@ApiResponse({ status: 404, description: 'Book or cover not found' })
	@ApiBearerAuth('JWT-auth')
	@UseInterceptors(
		FileInterceptor('file', {
			limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
			fileFilter: (req, file, callback) => {
				if (!file.mimetype.match(/^image\//)) {
					return callback(
						new BadRequestException('Only image files are allowed'),
						false,
					);
				}
				callback(null, true);
			},
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
		summary: 'Upload book cover',
		description: 'Upload a single cover image for a book (Admin only)',
	})
	@ApiConsumes('multipart/form-data')
	@ApiParam({
		name: 'idBook',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				file: {
					type: 'string',
					format: 'binary',
					description: 'Cover image file (JPG, PNG, WEBP)',
				},
				title: {
					type: 'string',
					description: 'Optional cover title',
					maxLength: 200,
				},
			},
			required: ['file'],
		},
	})
	@ApiResponse({ status: 201, description: 'Cover uploaded successfully' })
	@ApiResponse({ status: 400, description: 'Invalid file or data' })
	@ApiResponse({ status: 404, description: 'Book not found' })
	@ApiBearerAuth('JWT-auth')
	@UseInterceptors(
		FileInterceptor('file', {
			limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
			fileFilter: (req, file, callback) => {
				if (!file.mimetype.match(/^image\//)) {
					return callback(
						new BadRequestException('Only image files are allowed'),
						false,
					);
				}
				callback(null, true);
			},
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
		summary: 'Upload multiple book covers',
		description:
			'Upload multiple cover images for a book at once (Admin only)',
	})
	@ApiConsumes('multipart/form-data')
	@ApiParam({
		name: 'idBook',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				files: {
					type: 'array',
					items: {
						type: 'string',
						format: 'binary',
					},
					description: 'Multiple cover image files (max 10)',
				},
			},
			required: ['files'],
		},
	})
	@ApiResponse({ status: 201, description: 'Covers uploaded successfully' })
	@ApiResponse({ status: 400, description: 'Invalid files or data' })
	@ApiResponse({ status: 404, description: 'Book not found' })
	@ApiBearerAuth('JWT-auth')
	@UseInterceptors(
		FilesInterceptor('files', 10, {
			limits: { fileSize: 10 * 1024 * 1024 },
			fileFilter: (req, file, callback) => {
				if (!file.mimetype.match(/^image\//)) {
					return callback(
						new BadRequestException('Only image files are allowed'),
						false,
					);
				}
				callback(null, true);
			},
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
		summary: 'Upload chapter pages',
		description: 'Upload multiple page images for a chapter (Admin only)',
	})
	@ApiConsumes('multipart/form-data')
	@ApiParam({
		name: 'idChapter',
		description: 'Chapter unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				pages: {
					type: 'array',
					items: {
						type: 'string',
						format: 'binary',
					},
					description: 'Page image files (max 100)',
				},
				indices: {
					type: 'string',
					description:
						'JSON array of page indices (e.g., "[1,2,3,4,5]")',
					example: '[1,2,3,4,5]',
				},
			},
			required: ['pages', 'indices'],
		},
	})
	@ApiResponse({ status: 201, description: 'Pages uploaded successfully' })
	@ApiResponse({ status: 400, description: 'Invalid files or data' })
	@ApiResponse({ status: 404, description: 'Chapter not found' })
	@ApiBearerAuth('JWT-auth')
	@UseInterceptors(
		FilesInterceptor('pages', 100, {
			limits: { fileSize: 10 * 1024 * 1024 },
			fileFilter: (req, file, callback) => {
				if (!file.mimetype.match(/^image\//)) {
					return callback(
						new BadRequestException('Only image files are allowed'),
						false,
					);
				}
				callback(null, true);
			},
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

		let indices: number[];
		try {
			indices = JSON.parse(indicesStr);
		} catch (_error) {
			throw new BadRequestException(
				'Invalid indices format. Must be a JSON array of numbers',
			);
		}

		if (!Array.isArray(indices)) {
			throw new BadRequestException('Indices must be an array');
		}

		return this.bookUploadService.uploadChapterPages(
			idChapter,
			files,
			indices,
		);
	}
}
