import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

export function ApiDocsGetSavedPagesByBook() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get saved pages for a specific book',
			description:
				'Retrieve all saved pages of the current user for a specific book',
		}),
		ApiParam({
			name: 'bookId',
			description: 'Book unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Saved pages for the book retrieved successfully',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
	);
}
