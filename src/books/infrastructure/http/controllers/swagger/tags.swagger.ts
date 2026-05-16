import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

export function ApiDocsGetAll() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get all tags',
			description: 'Retrieve a list of all tags with pagination',
		}),
		ApiResponse({
			status: 200,
			description: 'Tags retrieved successfully',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({ status: 429, description: 'Too many requests' }),
	);
}

export function ApiDocsMergeTags() {
	return applyDecorators(
		ApiOperation({
			summary: 'Merge tags',
			description: 'Merge multiple tags into one (Admin only)',
		}),
		ApiParam({
			name: 'tagId',
			description: 'Target tag ID to merge into',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({ status: 200, description: 'Tags merged successfully' }),
		ApiResponse({ status: 404, description: 'Tag not found' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({ status: 429, description: 'Too many requests' }),
	);
}
