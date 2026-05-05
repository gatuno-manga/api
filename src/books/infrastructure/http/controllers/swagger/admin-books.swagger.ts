import { applyDecorators } from '@nestjs/common';
import {
	ApiBody,
	ApiConsumes,
	ApiOperation,
	ApiParam,
	ApiResponse,
} from '@nestjs/swagger';
import { ToggleAutoUpdateDto } from '@books/application/dto/toggle-auto-update.dto';
import { CreateChapterManualDto } from '@books/application/dto/create-chapter-manual.dto';

export function ApiDocsCreateBook() {
	return applyDecorators(
		ApiOperation({
			summary: 'Create a new book',
			description:
				'Create a new book with all its information (Admin only)',
		}),
		ApiResponse({ status: 201, description: 'Book created successfully' }),
		ApiResponse({ status: 400, description: 'Invalid input data' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
		ApiResponse({ status: 429, description: 'Too many requests' }),
	);
}

export function ApiDocsFixBook() {
	return applyDecorators(
		ApiOperation({
			summary: 'Fix book',
			description: 'Attempt to fix issues with a book (Admin only)',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({ status: 200, description: 'Book fixed successfully' }),
		ApiResponse({ status: 404, description: 'Book not found' }),
	);
}

export function ApiDocsVerifyBook() {
	return applyDecorators(
		ApiOperation({
			summary: 'Verify book',
			description: 'Verify book integrity and data (Admin only)',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Book verification completed',
		}),
		ApiResponse({ status: 404, description: 'Book not found' }),
	);
}

export function ApiDocsResetBook() {
	return applyDecorators(
		ApiOperation({
			summary: 'Reset book',
			description: 'Reset book data and cache (Admin only)',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({ status: 200, description: 'Book reset successfully' }),
		ApiResponse({ status: 404, description: 'Book not found' }),
	);
}

export function ApiDocsCheckBookUpdates() {
	return applyDecorators(
		ApiOperation({
			summary: 'Check for book updates',
			description:
				'Force check for new chapters on a specific book (Admin only)',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({ status: 200, description: 'Update check scheduled' }),
		ApiResponse({ status: 404, description: 'Book not found' }),
	);
}

export function ApiDocsCheckAllBooksUpdates() {
	return applyDecorators(
		ApiOperation({
			summary: 'Check updates for all books',
			description:
				'Force check for new chapters on all books (Admin only)',
		}),
		ApiResponse({
			status: 200,
			description: 'Update check scheduled for all books',
		}),
	);
}

export function ApiDocsToggleAutoUpdate() {
	return applyDecorators(
		ApiOperation({
			summary: 'Toggle automatic updates',
			description:
				'Enable or disable automatic update checks for a book (Admin only)',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiBody({
			type: ToggleAutoUpdateDto,
			description: 'Auto-update toggle settings',
			examples: {
				enable: {
					summary: 'Enable auto-update',
					value: { enabled: true },
				},
				disable: {
					summary: 'Disable auto-update',
					value: { enabled: false },
				},
			},
		}),
		ApiResponse({
			status: 200,
			description: 'Auto-update setting changed successfully',
			schema: {
				type: 'object',
				properties: {
					id: { type: 'string' },
					title: { type: 'string' },
					autoUpdate: { type: 'boolean' },
				},
			},
		}),
		ApiResponse({ status: 404, description: 'Book not found' }),
	);
}

export function ApiDocsUpdateChaptersBatch() {
	return applyDecorators(
		ApiOperation({
			summary: 'Update chapters',
			description: 'Update multiple chapters at once (Admin only)',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Chapters updated successfully',
		}),
		ApiResponse({ status: 404, description: 'Book not found' }),
		ApiResponse({ status: 400, description: 'Invalid input data' }),
	);
}

export function ApiDocsOrderChapters() {
	return applyDecorators(
		ApiOperation({
			summary: 'Reorder chapters',
			description: 'Change the order of book chapters (Admin only)',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Chapters reordered successfully',
		}),
		ApiResponse({ status: 404, description: 'Book not found' }),
		ApiResponse({ status: 400, description: 'Invalid input data' }),
	);
}

export function ApiDocsUpdateBook() {
	return applyDecorators(
		ApiOperation({
			summary: 'Update book',
			description: 'Update book information (Admin only)',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({ status: 200, description: 'Book updated successfully' }),
		ApiResponse({ status: 404, description: 'Book not found' }),
		ApiResponse({ status: 400, description: 'Invalid input data' }),
	);
}

export function ApiDocsSelectCover() {
	return applyDecorators(
		ApiOperation({
			summary: 'Select book cover',
			description:
				'Set a specific cover as the main cover for a book (Admin only)',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiParam({
			name: 'idCover',
			description: 'Cover unique identifier',
			example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
		}),
		ApiResponse({
			status: 200,
			description: 'Cover selected successfully',
		}),
		ApiResponse({ status: 404, description: 'Book or cover not found' }),
	);
}

export function ApiDocsOrderCovers() {
	return applyDecorators(
		ApiOperation({
			summary: 'Reorder book covers',
			description: 'Change the order of book covers (Admin only)',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Covers reordered successfully',
		}),
		ApiResponse({ status: 404, description: 'Book not found' }),
		ApiResponse({ status: 400, description: 'Invalid input data' }),
	);
}

export function ApiDocsFixCover() {
	return applyDecorators(
		ApiOperation({
			summary: 'Fix book cover',
			description:
				'Re-enqueue a specific cover for processing (Admin only)',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiParam({
			name: 'idCover',
			description: 'Cover unique identifier',
			example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
		}),
		ApiResponse({ status: 200, description: 'Cover fix job scheduled' }),
		ApiResponse({ status: 404, description: 'Book or cover not found' }),
	);
}

export function ApiDocsFixBookCovers() {
	return applyDecorators(
		ApiOperation({
			summary: 'Fix all book covers',
			description:
				'Re-enqueue all covers of a book for processing (Admin only)',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({ status: 200, description: 'Cover fix jobs scheduled' }),
		ApiResponse({ status: 404, description: 'Book not found' }),
	);
}

export function ApiDocsUpdateCover() {
	return applyDecorators(
		ApiOperation({
			summary: 'Update book cover',
			description: 'Update cover data for a book (Admin only)',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiParam({
			name: 'idCover',
			description: 'Cover unique identifier',
			example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
		}),
		ApiResponse({ status: 200, description: 'Cover updated successfully' }),
		ApiResponse({ status: 404, description: 'Book or cover not found' }),
	);
}

export function ApiDocsUploadCoverManual() {
	return applyDecorators(
		ApiConsumes('multipart/form-data'),
		ApiOperation({
			summary: 'Upload cover manually',
			description:
				'Upload a cover image file for a specific book (Admin only)',
		}),
		ApiBody({
			schema: {
				type: 'object',
				properties: {
					file: {
						type: 'string',
						format: 'binary',
						description: 'Image file (JPG, PNG, WebP)',
					},
					title: {
						type: 'string',
						description: 'Cover title (optional)',
					},
				},
			},
		}),
		ApiResponse({
			status: 201,
			description: 'Cover uploaded successfully',
		}),
		ApiResponse({ status: 404, description: 'Book not found' }),
	);
}

export function ApiDocsScrapeCover() {
	return applyDecorators(
		ApiOperation({
			summary: 'Scrape cover from URL',
			description:
				'Trigger the scraper to fetch a cover from an external URL (Admin only)',
		}),
		ApiResponse({ status: 201, description: 'Scrape job scheduled' }),
		ApiResponse({ status: 404, description: 'Book not found' }),
	);
}

export function ApiDocsCreateManualChapter() {
	return applyDecorators(
		ApiOperation({
			summary: 'Create manual chapter',
			description:
				'Create a chapter without URL for manual page upload (Admin only)',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 201,
			description: 'Chapter created successfully',
		}),
		ApiResponse({ status: 400, description: 'Invalid input data' }),
		ApiResponse({ status: 404, description: 'Book not found' }),
	);
}

export function ApiDocsCreateManualChapterWithContent() {
	return applyDecorators(
		ApiOperation({
			summary: 'Create manual chapter with optional text content',
			description:
				'Create a manual chapter and optionally include text content in the same request (Admin only)',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiBody({
			type: CreateChapterManualDto,
			description:
				"Use 'title' and 'index' as usual. If 'content' is provided, 'format' is required.",
		}),
		ApiResponse({
			status: 201,
			description: 'Chapter created successfully',
		}),
		ApiResponse({ status: 400, description: 'Invalid input data' }),
		ApiResponse({ status: 404, description: 'Book not found' }),
	);
}

export function ApiDocsCreateChaptersInBatch() {
	return applyDecorators(
		ApiOperation({
			summary: 'Create chapters in batch',
			description:
				'Create manual chapters in batch, optionally with text content (Admin only)',
		}),
		ApiBody({
			schema: {
				type: 'array',
				items: {
					$ref: '#/components/schemas/CreateChapterBatchItemDto',
				},
			},
		}),
		ApiResponse({
			status: 201,
			description: 'Batch processed with per-item status',
		}),
		ApiResponse({ status: 400, description: 'Invalid input data' }),
	);
}

export function ApiDocsDeleteBook() {
	return applyDecorators(
		ApiOperation({
			summary: 'Delete book (soft delete)',
			description:
				'Soft delete a book and schedule its files for deletion after retention period (Admin only)',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({ status: 200, description: 'Book deleted successfully' }),
		ApiResponse({ status: 404, description: 'Book not found' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}

export function ApiDocsDeleteBooksInBatch() {
	return applyDecorators(
		ApiOperation({
			summary: 'Delete multiple books (batch)',
			description:
				'Soft delete multiple books at once (max 100) (Admin only)',
		}),
		ApiBody({
			schema: {
				type: 'object',
				properties: {
					bookIds: {
						type: 'array',
						items: { type: 'string' },
						description: 'Array of book IDs to delete',
						example: [
							'550e8400-e29b-41d4-a716-446655440000',
							'6ba7b810-9dad-11d1-80b4-00c04fd430c8',
						],
					},
				},
				required: ['bookIds'],
			},
		}),
		ApiResponse({ status: 200, description: 'Books deleted successfully' }),
		ApiResponse({
			status: 400,
			description: 'Invalid input or too many books',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}

export function ApiDocsDeleteChapter() {
	return applyDecorators(
		ApiOperation({
			summary: 'Delete chapter (soft delete)',
			description:
				'Soft delete a chapter and schedule its pages for deletion (Admin only)',
		}),
		ApiParam({
			name: 'idChapter',
			description: 'Chapter unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Chapter deleted successfully',
		}),
		ApiResponse({ status: 404, description: 'Chapter not found' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}

export function ApiDocsDeleteChaptersInBatch() {
	return applyDecorators(
		ApiOperation({
			summary: 'Delete multiple chapters (batch)',
			description:
				'Soft delete multiple chapters at once (max 100) (Admin only)',
		}),
		ApiBody({
			schema: {
				type: 'object',
				properties: {
					chapterIds: {
						type: 'array',
						items: { type: 'string' },
						description: 'Array of chapter IDs to delete',
						example: ['550e8400-e29b-41d4-a716-446655440000'],
					},
				},
				required: ['chapterIds'],
			},
		}),
		ApiResponse({
			status: 200,
			description: 'Chapters deleted successfully',
		}),
		ApiResponse({
			status: 400,
			description: 'Invalid input or too many chapters',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}

export function ApiDocsDeleteCover() {
	return applyDecorators(
		ApiOperation({
			summary: 'Delete book cover',
			description: 'Soft delete a specific cover image (Admin only)',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiParam({
			name: 'idCover',
			description: 'Cover unique identifier',
			example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
		}),
		ApiResponse({ status: 200, description: 'Cover deleted successfully' }),
		ApiResponse({ status: 404, description: 'Cover not found' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}

export function ApiDocsDeleteCoversInBatch() {
	return applyDecorators(
		ApiOperation({
			summary: 'Delete multiple covers (batch)',
			description: 'Soft delete multiple covers at once (Admin only)',
		}),
		ApiBody({
			schema: {
				type: 'object',
				properties: {
					coverIds: {
						type: 'array',
						items: { type: 'string' },
						description: 'Array of cover IDs to delete',
						example: ['6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
					},
				},
				required: ['coverIds'],
			},
		}),
		ApiResponse({
			status: 200,
			description: 'Covers deleted successfully',
		}),
		ApiResponse({ status: 400, description: 'Invalid input' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}

export function ApiDocsDeletePages() {
	return applyDecorators(
		ApiOperation({
			summary: 'Delete chapter pages',
			description:
				'Soft delete specific pages from a chapter (Admin only)',
		}),
		ApiParam({
			name: 'idChapter',
			description: 'Chapter unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiBody({
			schema: {
				type: 'object',
				properties: {
					pageIndices: {
						type: 'array',
						items: { type: 'number' },
						description: 'Array of page indices to delete',
						example: [1, 2, 3],
					},
				},
				required: ['pageIndices'],
			},
		}),
		ApiResponse({ status: 200, description: 'Pages deleted successfully' }),
		ApiResponse({ status: 400, description: 'Invalid input' }),
		ApiResponse({ status: 404, description: 'Chapter or pages not found' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}

export function ApiDocsListDeletedBooks() {
	return applyDecorators(
		ApiOperation({
			summary: 'List deleted books',
			description:
				'Retrieve all soft-deleted books pending permanent deletion (Admin only)',
		}),
		ApiResponse({
			status: 200,
			description: 'Deleted books retrieved successfully',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}

export function ApiDocsListDeletedChapters() {
	return applyDecorators(
		ApiOperation({
			summary: 'List deleted chapters',
			description:
				'Retrieve all soft-deleted chapters pending permanent deletion (Admin only)',
		}),
		ApiResponse({
			status: 200,
			description: 'Deleted chapters retrieved successfully',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}

export function ApiDocsListDeletedCovers() {
	return applyDecorators(
		ApiOperation({
			summary: 'List deleted covers',
			description:
				'Retrieve all soft-deleted covers pending permanent deletion (Admin only)',
		}),
		ApiResponse({
			status: 200,
			description: 'Deleted covers retrieved successfully',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}

export function ApiDocsListDeletedPages() {
	return applyDecorators(
		ApiOperation({
			summary: 'List deleted pages',
			description:
				'Retrieve all soft-deleted pages pending permanent deletion (Admin only)',
		}),
		ApiResponse({
			status: 200,
			description: 'Deleted pages retrieved successfully',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}
