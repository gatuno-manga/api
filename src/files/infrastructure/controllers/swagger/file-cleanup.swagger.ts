import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

export function ApiDocsScanOrphans() {
	return applyDecorators(
		ApiOperation({
			summary: 'Scan for orphan files',
			description:
				'Find files that exist in filesystem but have no database reference (Admin only)',
		}),
		ApiResponse({
			status: 200,
			description: 'Orphan files scan completed',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}

export function ApiDocsCleanupOrphans() {
	return applyDecorators(
		ApiOperation({
			summary: 'Cleanup orphan files',
			description:
				'Delete orphan files from filesystem. Use dryRun=true to preview (Admin only)',
		}),
		ApiQuery({
			name: 'dryRun',
			required: false,
			type: Boolean,
			description:
				'If true, only shows what would be deleted without actually deleting',
			example: true,
		}),
		ApiResponse({
			status: 200,
			description: 'Cleanup completed or simulated',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}

export function ApiDocsCleanupOrphansImmediate() {
	return applyDecorators(
		ApiOperation({
			summary: 'Cleanup orphan files immediately',
			description:
				'Delete ALL orphan files immediately without dry run. USE WITH CAUTION! (Admin only)',
		}),
		ApiResponse({
			status: 200,
			description: 'Immediate cleanup completed',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}

export function ApiDocsCheckIntegrity() {
	return applyDecorators(
		ApiOperation({
			summary: 'Check file integrity',
			description:
				'Find database records that reference missing files (Admin only)',
		}),
		ApiResponse({ status: 200, description: 'Integrity check completed' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}

export function ApiDocsCleanupOldDeletedFiles() {
	return applyDecorators(
		ApiOperation({
			summary: 'Cleanup old deleted files',
			description:
				'Permanently delete files from entities deleted more than configured retention days ago (Admin only)',
		}),
		ApiResponse({
			status: 200,
			description: 'Old deleted files cleanup completed',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}

export function ApiDocsGetStorageStats() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get storage statistics',
			description:
				'Retrieve comprehensive storage usage statistics (Admin only)',
		}),
		ApiResponse({
			status: 200,
			description: 'Statistics retrieved successfully',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({
			status: 403,
			description: 'Forbidden - Admin role required',
		}),
	);
}
