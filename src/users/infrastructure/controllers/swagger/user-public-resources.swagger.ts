import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

export function ApiDocsGetPublicProfile() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get public profile of a user',
			description: 'Retrieve public user profile information',
		}),
		ApiParam({
			name: 'userId',
			description: 'User unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({ status: 200, description: 'Public profile retrieved' }),
		ApiResponse({ status: 404, description: 'User not found' }),
	);
}

export function ApiDocsGetPublicCollections() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get public collections of a user',
			description: 'Retrieve collections that are marked as public',
		}),
		ApiParam({
			name: 'userId',
			description: 'User unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Public collections retrieved',
		}),
	);
}

export function ApiDocsGetPublicSavedPages() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get public saved pages of a user',
			description: 'Retrieve saved pages that are marked as public',
		}),
		ApiParam({
			name: 'userId',
			description: 'User unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiResponse({
			status: 200,
			description: 'Public saved pages retrieved',
		}),
	);
}

export function ApiDocsGetPublicSavedPagesByBook() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get public saved pages of a user by book',
			description:
				'Retrieve public saved pages of a user filtered by a specific book',
		}),
		ApiParam({
			name: 'userId',
			description: 'User unique identifier',
			example: '550e8400-e29b-41d4-a716-446655440000',
		}),
		ApiParam({
			name: 'bookId',
			description: 'Book unique identifier',
			example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
		}),
		ApiResponse({
			status: 200,
			description: 'Public saved pages by book retrieved',
		}),
	);
}
