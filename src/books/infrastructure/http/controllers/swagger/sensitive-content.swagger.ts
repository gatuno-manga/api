import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

export function ApiDocsGetAll() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get all sensitive content tags',
			description: 'Retrieve all available sensitive content categories',
		}),
		ApiResponse({
			status: 200,
			description: 'Sensitive content tags retrieved successfully',
		}),
		ApiResponse({ status: 429, description: 'Too many requests' }),
	);
}

export function ApiDocsGetOne() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get sensitive content by ID',
			description: 'Retrieve details of a specific sensitive content tag',
		}),
		ApiParam({
			name: 'id',
			description: 'Sensitive content unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({ status: 200, description: 'Sensitive content found' }),
		ApiResponse({
			status: 404,
			description: 'Sensitive content not found',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({ status: 429, description: 'Too many requests' }),
	);
}

export function ApiDocsCreate() {
	return applyDecorators(
		ApiOperation({
			summary: 'Create sensitive content tag',
			description: 'Create a new sensitive content category (Admin only)',
		}),
		ApiResponse({
			status: 201,
			description: 'Sensitive content created successfully',
		}),
		ApiResponse({ status: 400, description: 'Invalid input data' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({ status: 429, description: 'Too many requests' }),
	);
}

export function ApiDocsUpdate() {
	return applyDecorators(
		ApiOperation({
			summary: 'Update sensitive content tag',
			description: 'Update a sensitive content category (Admin only)',
		}),
		ApiParam({
			name: 'id',
			description: 'Sensitive content unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Sensitive content updated successfully',
		}),
		ApiResponse({
			status: 404,
			description: 'Sensitive content not found',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}

export function ApiDocsRemove() {
	return applyDecorators(
		ApiOperation({
			summary: 'Delete sensitive content tag',
			description: 'Remove a sensitive content category (Admin only)',
		}),
		ApiParam({
			name: 'id',
			description: 'Sensitive content unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Sensitive content deleted successfully',
		}),
		ApiResponse({
			status: 404,
			description: 'Sensitive content not found',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}

export function ApiDocsMergeSensitiveContent() {
	return applyDecorators(
		ApiOperation({
			summary: 'Merge sensitive content tags',
			description:
				'Merge multiple sensitive content tags into one (Admin only)',
		}),
		ApiParam({
			name: 'contentId',
			description: 'Target sensitive content ID to merge into',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Sensitive content tags merged successfully',
		}),
		ApiResponse({
			status: 404,
			description: 'Sensitive content not found',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}
