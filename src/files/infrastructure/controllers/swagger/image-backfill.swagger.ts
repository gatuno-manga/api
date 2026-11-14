import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

export function ApiDocsBackfill() {
	return applyDecorators(
		ApiOperation({
			summary: 'Reprocess pending images',
			description:
				'Scan for images stuck in processing, without pHash metadata, or (covers only) without smaller resolution variants, and request (re)processing (Admin only)',
		}),
		ApiResponse({
			status: 202,
			description: 'Reprocessing scan started successfully',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}

export function ApiDocsReprocessCover() {
	return applyDecorators(
		ApiOperation({
			summary: 'Reprocess a single cover',
			description:
				'Requests immediate reprocessing of one cover by id, without waiting for the recurring scan (Admin only)',
		}),
		ApiParam({ name: 'id', description: 'Cover id' }),
		ApiResponse({ status: 202, description: 'Reprocessing requested' }),
		ApiResponse({ status: 404, description: 'Cover not found' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}
