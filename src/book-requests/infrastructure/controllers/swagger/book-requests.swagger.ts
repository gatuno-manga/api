import { BookRequestResponseDto } from '@/book-requests/infrastructure/http/dto/book-request-response.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export function ApiDocsCreate() {
	return applyDecorators(
		ApiOperation({
			summary: 'Create a new book request',
			description:
				'Allows a user to request a book to be added by an admin',
		}),
		ApiResponse({
			status: 201,
			description: 'Request created successfully',
		}),
		ApiResponse({ status: 400, description: 'Invalid data' }),
	);
}

export function ApiDocsListMyRequests() {
	return applyDecorators(
		ApiOperation({
			summary: 'List my book requests',
			description:
				'Returns a list of book requests made by the current user',
		}),
		ApiResponse({
			status: 200,
			description: 'List of requests',
			type: [BookRequestResponseDto],
		}),
	);
}
