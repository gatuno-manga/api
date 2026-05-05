import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

export function ApiDocsRegisterWebsite() {
	return applyDecorators(
		ApiOperation({
			summary: 'Register website for scraping',
			description:
				'Register a new website configuration for content scraping (Admin only)',
		}),
		ApiResponse({
			status: 201,
			description: 'Website registered successfully',
		}),
		ApiResponse({ status: 400, description: 'Invalid input data' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
		ApiResponse({ status: 429, description: 'Too many requests' }),
	);
}

export function ApiDocsFindAll() {
	return applyDecorators(
		ApiOperation({
			summary: 'List all websites',
			description:
				'Get all registered website configurations (Admin only)',
		}),
		ApiResponse({
			status: 200,
			description: 'List of websites returned successfully',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}

export function ApiDocsFindOne() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get website by ID',
			description:
				'Get a specific website configuration by ID (Admin only)',
		}),
		ApiParam({ name: 'id', description: 'Website UUID', type: 'string' }),
		ApiResponse({
			status: 200,
			description: 'Website returned successfully',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
		ApiResponse({ status: 404, description: 'Website not found' }),
	);
}

export function ApiDocsUpdate() {
	return applyDecorators(
		ApiOperation({
			summary: 'Update website',
			description:
				'Update an existing website configuration (Admin only)',
		}),
		ApiParam({ name: 'id', description: 'Website UUID', type: 'string' }),
		ApiResponse({
			status: 200,
			description: 'Website updated successfully',
		}),
		ApiResponse({ status: 400, description: 'Invalid input data' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
		ApiResponse({ status: 404, description: 'Website not found' }),
		ApiResponse({ status: 429, description: 'Too many requests' }),
	);
}

export function ApiDocsRemove() {
	return applyDecorators(
		ApiOperation({
			summary: 'Delete website',
			description: 'Delete a website configuration (Admin only)',
		}),
		ApiParam({ name: 'id', description: 'Website UUID', type: 'string' }),
		ApiResponse({
			status: 200,
			description: 'Website deleted successfully',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
		ApiResponse({ status: 404, description: 'Website not found' }),
		ApiResponse({ status: 429, description: 'Too many requests' }),
	);
}
