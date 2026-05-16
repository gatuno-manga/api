import { applyDecorators } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

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

export function ApiDocsShare() {
	return applyDecorators(
		ApiOperation({ summary: 'Share a collection with a collaborator' }),
	);
}
