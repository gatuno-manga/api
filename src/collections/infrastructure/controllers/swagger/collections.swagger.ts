import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export function ApiDocsGetMyCollections() {
	return applyDecorators(ApiOperation({ summary: 'Get my collections' }));
}

export function ApiDocsCreate() {
	return applyDecorators(ApiOperation({ summary: 'Create a collection' }));
}

export function ApiDocsAddBook() {
	return applyDecorators(
		ApiOperation({ summary: 'Add a book to a collection' }),
	);
}

export function ApiDocsDelete() {
	return applyDecorators(
		ApiOperation({
			summary: 'Delete a collection',
			description: 'Deletes a specific collection belonging to the user',
		}),
		ApiResponse({
			status: 200,
			description: 'Collection successfully deleted',
		}),
		ApiResponse({
			status: 403,
			description: 'Forbidden: Insufficient permissions or not the owner',
		}),
		ApiResponse({
			status: 404,
			description: 'Collection not found',
		}),
	);
}

export function ApiDocsShare() {
	return applyDecorators(
		ApiOperation({ summary: 'Share a collection with a collaborator' }),
	);
}

export function ApiDocsUpdateCover() {
	return applyDecorators(
		ApiOperation({ summary: 'Update collection cover URL' }),
	);
}
