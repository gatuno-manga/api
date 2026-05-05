import {
	Controller,
	DefaultValuePipe,
	Delete,
	Get,
	ParseBoolPipe,
	Query,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { Throttle } from '@nestjs/throttler';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import { FileCleanupService } from '@files/application/services/file-cleanup.service';
import {
	ApiDocsScanOrphans,
	ApiDocsCleanupOrphans,
	ApiDocsCleanupOrphansImmediate,
	ApiDocsCheckIntegrity,
	ApiDocsCleanupOldDeletedFiles,
	ApiDocsGetStorageStats,
} from './swagger/file-cleanup.swagger';

@ApiTags('Admin - File Cleanup')
@Controller('admin/files')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class FileCleanupController {
	constructor(private readonly fileCleanupService: FileCleanupService) {}

	@Get('orphans/scan')
	@Throttle({ medium: { limit: 10, ttl: 60000 } })
	@ApiDocsScanOrphans() // 10 req/min
	async scanOrphans() {
		const orphanFiles = await this.fileCleanupService.findOrphanFiles();

		const totalSize = orphanFiles.reduce((sum, file) => sum + file.size, 0);

		return {
			orphanFiles,
			summary: {
				totalCount: orphanFiles.length,
				totalSize,
				totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
			},
		};
	}

	@Delete('orphans/cleanup')
	@Throttle({ short: { limit: 2, ttl: 60000 } })
	@ApiDocsCleanupOrphans() // 2 req/min
	async cleanupOrphans(
		@Query('dryRun', new DefaultValuePipe(true), ParseBoolPipe)
		dryRun: boolean,
	) {
		return this.fileCleanupService.cleanupOrphanFiles(dryRun);
	}

	@Delete('orphans/cleanup-immediate')
	@Throttle({ short: { limit: 1, ttl: 300000 } })
	@ApiDocsCleanupOrphansImmediate() // 1 req/5min
	async cleanupOrphansImmediate() {
		return this.fileCleanupService.cleanupOrphansImmediate();
	}

	@Get('integrity/check')
	@Throttle({ medium: { limit: 10, ttl: 60000 } })
	@ApiDocsCheckIntegrity() // 10 req/min
	async checkIntegrity() {
		const missingFiles = await this.fileCleanupService.findMissingFiles();

		return {
			missingFiles,
			summary: {
				totalCount: missingFiles.length,
				byType: {
					pages: missingFiles.filter((f) => f.entityType === 'page')
						.length,
					covers: missingFiles.filter((f) => f.entityType === 'cover')
						.length,
				},
			},
		};
	}

	@Delete('old-deleted/cleanup')
	@Throttle({ short: { limit: 1, ttl: 300000 } })
	@ApiDocsCleanupOldDeletedFiles() // 1 req/5min
	async cleanupOldDeletedFiles() {
		return this.fileCleanupService.cleanupOldDeletedFiles();
	}

	@Get('stats')
	@Throttle({ long: { limit: 100, ttl: 60000 } })
	@ApiDocsGetStorageStats() // 100 req/min
	async getStorageStats() {
		return this.fileCleanupService.getStorageStatistics();
	}
}
