import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

export function ApiDocsGetAll() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get all authors',
			description: 'Retrieve a list of all authors with pagination',
		}),
		ApiResponse({
			status: 200,
			description: 'Authors retrieved successfully',
		}),
		ApiResponse({ status: 429, description: 'Too many requests' }),
	);
}

export function ApiDocsMergeAuthors() {
	return applyDecorators(
		ApiOperation({
			summary: 'Merge authors',
			description: 'Merge multiple authors into one (Admin only)',
		}),
		ApiParam({
			name: 'authorId',
			description: 'Target author ID to merge into',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Authors merged successfully',
		}),
		ApiResponse({ status: 404, description: 'Author not found' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
		ApiResponse({ status: 429, description: 'Too many requests' }),
	);
}
