import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

export function ApiDocsSavePage() {
	return applyDecorators(
		ApiOperation({
			summary: 'Save a page',
			description:
				'Save a page to your favorites with an optional comment',
		}),
		ApiResponse({ status: 201, description: 'Page saved successfully' }),
		ApiResponse({
			status: 400,
			description: 'Page already saved or invalid data',
		}),
		ApiResponse({ status: 404, description: 'Page not found' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}

export function ApiDocsGetSavedPages() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get all saved pages',
			description: 'Retrieve all saved pages for the current user',
		}),
		ApiResponse({
			status: 200,
			description: 'Saved pages retrieved successfully',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}

export function ApiDocsGetSavedPagesByBook() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get saved pages by book',
			description: 'Retrieve all saved pages for a specific book',
		}),
		ApiParam({
			name: 'bookId',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Saved pages retrieved successfully',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}

export function ApiDocsGetSavedPagesByChapter() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get saved pages by chapter',
			description: 'Retrieve all saved pages for a specific chapter',
		}),
		ApiParam({
			name: 'chapterId',
			description: 'Chapter unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Saved pages retrieved successfully',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}

export function ApiDocsIsPageSaved() {
	return applyDecorators(
		ApiOperation({
			summary: 'Check if page is saved',
			description: 'Check if a specific page is saved by the user',
		}),
		ApiParam({
			name: 'pageId',
			description: 'Page ID',
			example: 1,
		}),
		ApiResponse({
			status: 200,
			description: 'Returns whether the page is saved',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}

export function ApiDocsCountSavedPagesByBook() {
	return applyDecorators(
		ApiOperation({
			summary: 'Count saved pages by book',
			description: 'Get the count of saved pages for a specific book',
		}),
		ApiParam({
			name: 'bookId',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Count retrieved successfully',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}

export function ApiDocsGetSavedPage() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get saved page by ID',
			description: 'Retrieve a specific saved page with all details',
		}),
		ApiParam({
			name: 'id',
			description: 'Saved page unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({ status: 200, description: 'Saved page found' }),
		ApiResponse({ status: 404, description: 'Saved page not found' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}

export function ApiDocsUpdateComment() {
	return applyDecorators(
		ApiOperation({
			summary: 'Update saved page comment',
			description: 'Update the comment on a saved page',
		}),
		ApiParam({
			name: 'id',
			description: 'Saved page unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Comment updated successfully',
		}),
		ApiResponse({ status: 404, description: 'Saved page not found' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}

export function ApiDocsUnsavePage() {
	return applyDecorators(
		ApiOperation({
			summary: 'Unsave a page',
			description: 'Remove a page from saved pages by saved page ID',
		}),
		ApiParam({
			name: 'id',
			description: 'Saved page unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({ status: 200, description: 'Page unsaved successfully' }),
		ApiResponse({ status: 404, description: 'Saved page not found' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}

export function ApiDocsUnsavePageByPageId() {
	return applyDecorators(
		ApiOperation({
			summary: 'Unsave a page by page ID',
			description:
				'Remove a page from saved pages using the original page ID',
		}),
		ApiParam({
			name: 'pageId',
			description: 'Original page ID',
			example: 1,
		}),
		ApiResponse({ status: 200, description: 'Page unsaved successfully' }),
		ApiResponse({ status: 404, description: 'Saved page not found' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}

export function ApiDocsUpdateVisibility() {
	return applyDecorators(
		ApiOperation({
			summary: 'Update saved page visibility',
			description: 'Update whether a saved page is public or private',
		}),
		ApiParam({
			name: 'id',
			description: 'Saved page unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Visibility updated successfully',
		}),
		ApiResponse({ status: 404, description: 'Saved page not found' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}
