import { BooksService } from '@books/application/services/books.service';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import {
	ApiDocsDashboard,
	ApiDocsGetQueueStats,
	ApiDocsProcessBookDashboard,
} from './swagger/admin-books-dashboard.swagger';

@ApiTags('Books Admin Dashboard')
@Controller('books')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Roles(RolesEnum.ADMIN)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class AdminBooksDashboardController {
	constructor(private readonly booksService: BooksService) {}

	@Get('dashboard/overview')
	@Permissions(PermissionsEnum.BOOKS_DASHBOARD_VIEW)
	@UseInterceptors(CacheInterceptor)
	@CacheTTL(60 * 60)
	@ApiDocsDashboard() // 1h
	dashboard() {
		return this.booksService.getDashboardOverview();
	}

	@Get('dashboard/process-book')
	@Permissions(PermissionsEnum.BOOKS_DASHBOARD_VIEW)
	@ApiDocsProcessBookDashboard()
	processBookDashboard() {
		return this.booksService.getProcessBook();
	}

	@Get('dashboard/queue-stats')
	@Permissions(PermissionsEnum.BOOKS_DASHBOARD_VIEW)
	@ApiDocsGetQueueStats()
	async getQueueStats() {
		return this.booksService.getQueueStats();
	}
}
