import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export function ApiDocsBackfill() {
	return applyDecorators(
		ApiOperation({
			summary: 'Backfill image metadata',
			description:
				'Scan for images without pHash metadata and request processing (Admin only)',
		}),
		ApiResponse({
			status: 202,
			description: 'Backfill process started successfully',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}
