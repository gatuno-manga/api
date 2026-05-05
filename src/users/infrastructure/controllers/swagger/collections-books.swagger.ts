import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

export function ApiDocsGetCollectionBooks() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get all user collections',
			description: 'Retrieve all book collections for the current user',
		}),
		ApiResponse({
			status: 200,
			description: 'Collections retrieved successfully',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}

export function ApiDocsGetNameCollectionBooks() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get collection names',
			description: 'Retrieve only the names of all collections',
		}),
		ApiResponse({
			status: 200,
			description: 'Collection names retrieved successfully',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}

export function ApiDocsGetCollectionById() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get collection by ID',
			description: 'Retrieve a specific collection with all its books',
		}),
		ApiParam({
			name: 'idCollection',
			description: 'Collection unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({ status: 200, description: 'Collection found' }),
		ApiResponse({ status: 404, description: 'Collection not found' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}

export function ApiDocsCreateCollectionBook() {
	return applyDecorators(
		ApiOperation({
			summary: 'Create a new collection',
			description: 'Create a new book collection for the user',
		}),
		ApiResponse({
			status: 201,
			description: 'Collection created successfully',
		}),
		ApiResponse({ status: 400, description: 'Invalid input data' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}

export function ApiDocsAddBookToCollection() {
	return applyDecorators(
		ApiOperation({
			summary: 'Add books to collection',
			description: 'Add one or more books to an existing collection',
		}),
		ApiParam({
			name: 'idCollection',
			description: 'Collection unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({ status: 200, description: 'Books added successfully' }),
		ApiResponse({ status: 404, description: 'Collection not found' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}

export function ApiDocsRemoveBookFromCollection() {
	return applyDecorators(
		ApiOperation({
			summary: 'Remove book from collection',
			description: 'Remove a specific book from a collection',
		}),
		ApiParam({
			name: 'idCollection',
			description: 'Collection unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiParam({
			name: 'idBook',
			description: 'Book unique identifier',
			example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
		}),
		ApiResponse({ status: 200, description: 'Book removed successfully' }),
		ApiResponse({
			status: 404,
			description: 'Collection or book not found',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}

export function ApiDocsDeleteCollection() {
	return applyDecorators(
		ApiOperation({
			summary: 'Delete collection',
			description: 'Delete an entire collection',
		}),
		ApiParam({
			name: 'idCollection',
			description: 'Collection unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Collection deleted successfully',
		}),
		ApiResponse({ status: 404, description: 'Collection not found' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}

export function ApiDocsUpdateVisibility() {
	return applyDecorators(
		ApiOperation({
			summary: 'Update collection visibility',
			description: 'Update whether a collection is public or private',
		}),
		ApiParam({
			name: 'idCollection',
			description: 'Collection unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Visibility updated successfully',
		}),
		ApiResponse({ status: 404, description: 'Collection not found' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}
