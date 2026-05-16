import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import { BooksService } from '@books/application/services/books.service';
import {
	ApiDocsDashboard,
	ApiDocsProcessBookDashboard,
	ApiDocsGetQueueStats,
} from './swagger/admin-books-dashboard.swagger';

@ApiTags('Books Admin Dashboard')
@Controller('books')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class AdminBooksDashboardController {
	constructor(private readonly booksService: BooksService) {}

	@Get('dashboard/overview')
	@UseInterceptors(CacheInterceptor)
	@CacheTTL(60 * 60)
	@ApiDocsDashboard() // 1h
	dashboard() {
		return this.booksService.getDashboardOverview();
	}

	@Get('dashboard/process-book')
	@ApiDocsProcessBookDashboard()
	processBookDashboard() {
		return this.booksService.getProcessBook();
	}

	@Get('dashboard/queue-stats')
	@ApiDocsGetQueueStats()
	async getQueueStats() {
		return this.booksService.getQueueStats();
	}
}
