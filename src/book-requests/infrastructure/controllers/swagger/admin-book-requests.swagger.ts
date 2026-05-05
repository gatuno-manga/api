import { BookRequestResponseDto } from '@/book-requests/infrastructure/http/dto/book-request-response.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export function ApiDocsListAll() {
	return applyDecorators(
		ApiOperation({
			summary: 'List all book requests',
			description: 'Returns a list of all book requests (Admin only)',
		}),
		ApiResponse({
			status: 200,
			description: 'List of requests',
			type: [BookRequestResponseDto],
		}),
	);
}

export function ApiDocsApprove() {
	return applyDecorators(
		ApiOperation({
			summary: 'Approve a book request',
			description: 'Marks a book request as approved (Admin only)',
		}),
		ApiResponse({
			status: 200,
			description: 'Request approved successfully',
		}),
		ApiResponse({ status: 404, description: 'Request not found' }),
	);
}

export function ApiDocsReject() {
	return applyDecorators(
		ApiOperation({
			summary: 'Reject a book request',
			description:
				'Marks a book request as rejected with a reason (Admin only)',
		}),
		ApiResponse({
			status: 200,
			description: 'Request rejected successfully',
		}),
		ApiResponse({ status: 404, description: 'Request not found' }),
	);
}
