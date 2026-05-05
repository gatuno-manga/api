import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export function ApiDocsDashboard() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get dashboard overview',
			description:
				'Retrieve dashboard statistics and overview (Admin only)',
		}),
		ApiResponse({
			status: 200,
			description: 'Dashboard data retrieved successfully',
		}),
	);
}

export function ApiDocsProcessBookDashboard() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get book processing status',
			description: 'Retrieve status of book processing jobs (Admin only)',
		}),
		ApiResponse({
			status: 200,
			description: 'Processing status retrieved successfully',
		}),
	);
}

export function ApiDocsGetQueueStats() {
	return applyDecorators(
		ApiOperation({
			summary: 'Get update queue statistics',
			description:
				'Retrieve statistics about the book update queue (Admin only)',
		}),
		ApiResponse({
			status: 200,
			description: 'Queue statistics retrieved successfully',
			schema: {
				type: 'object',
				properties: {
					queues: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								name: {
									type: 'string',
									example: 'book-update-queue',
								},
								counts: {
									type: 'object',
									properties: {
										waiting: { type: 'number' },
										active: { type: 'number' },
										completed: { type: 'number' },
										failed: { type: 'number' },
										delayed: { type: 'number' },
									},
								},
								activeJobs: {
									type: 'array',
									items: {
										type: 'object',
										properties: {
											id: { type: 'string' },
											bookId: {
												type: 'string',
												nullable: true,
											},
											bookTitle: { type: 'string' },
											chapterId: {
												type: 'string',
												nullable: true,
											},
											chapterTitle: {
												type: 'string',
												nullable: true,
											},
											urlOrigin: {
												type: 'string',
												nullable: true,
											},
											timestamp: { type: 'number' },
										},
									},
								},
								pendingJobs: {
									type: 'array',
									items: {
										type: 'object',
										properties: {
											id: { type: 'string' },
											bookId: {
												type: 'string',
												nullable: true,
											},
											bookTitle: { type: 'string' },
											chapterId: {
												type: 'string',
												nullable: true,
											},
											chapterTitle: {
												type: 'string',
												nullable: true,
											},
											urlOrigin: {
												type: 'string',
												nullable: true,
											},
											timestamp: { type: 'number' },
											delayed: { type: 'boolean' },
											processAt: {
												type: 'string',
												format: 'date-time',
												nullable: true,
											},
										},
									},
								},
							},
						},
					},
				},
			},
		}),
	);
}
