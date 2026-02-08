import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesEnum } from 'src/users/enum/roles.enum';
import { BooksService } from './books.service';

@ApiTags('Books Admin Dashboard')
@Controller('books')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
export class AdminBooksDashboardController {
	constructor(private readonly booksService: BooksService) {}

	@Get('dashboard/overview')
	@ApiOperation({
		summary: 'Get dashboard overview',
		description: 'Retrieve dashboard statistics and overview (Admin only)',
	})
	@ApiResponse({
		status: 200,
		description: 'Dashboard data retrieved successfully',
	})
	@ApiBearerAuth('JWT-auth')
	@UseInterceptors(CacheInterceptor)
	@CacheTTL(60 * 60) // 1h
	dashboard() {
		return this.booksService.getDashboardOverview();
	}

	@Get('dashboard/process-book')
	@ApiOperation({
		summary: 'Get book processing status',
		description: 'Retrieve status of book processing jobs (Admin only)',
	})
	@ApiResponse({
		status: 200,
		description: 'Processing status retrieved successfully',
	})
	@ApiBearerAuth('JWT-auth')
	processBookDashboard() {
		return this.booksService.getProcessBook();
	}

	@Get('dashboard/queue-stats')
	@ApiOperation({
		summary: 'Get update queue statistics',
		description:
			'Retrieve statistics about the book update queue (Admin only)',
	})
	@ApiResponse({
		status: 200,
		description: 'Queue statistics retrieved successfully',
		schema: {
			type: 'object',
			properties: {
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
							bookId: { type: 'string' },
							bookTitle: { type: 'string' },
							timestamp: { type: 'number' },
						},
					},
				},
				waitingJobs: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							id: { type: 'string' },
							bookId: { type: 'string' },
							bookTitle: { type: 'string' },
						},
					},
				},
			},
		},
	})
	@ApiBearerAuth('JWT-auth')
	async getQueueStats() {
		return this.booksService.getQueueStats();
	}
}
