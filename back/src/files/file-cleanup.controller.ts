import { Controller, Get, Delete, Query, UseGuards, ParseBoolPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from 'src/users/enum/roles.enum';
import { FileCleanupService } from './file-cleanup.service';

@ApiTags('Admin - File Cleanup')
@Controller('admin/files')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
@ApiBearerAuth('JWT-auth')
export class FileCleanupController {
    constructor(private readonly fileCleanupService: FileCleanupService) {}

    @Get('orphans/scan')
    @Throttle({ medium: { limit: 10, ttl: 60000 } }) // 10 req/min
    @ApiOperation({
        summary: 'Scan for orphan files',
        description: 'Find files that exist in filesystem but have no database reference (Admin only)',
    })
    @ApiResponse({ status: 200, description: 'Orphan files scan completed' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
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
    @Throttle({ short: { limit: 2, ttl: 60000 } }) // 2 req/min
    @ApiOperation({
        summary: 'Cleanup orphan files',
        description: 'Delete orphan files from filesystem. Use dryRun=true to preview (Admin only)',
    })
    @ApiQuery({
        name: 'dryRun',
        required: false,
        type: Boolean,
        description: 'If true, only shows what would be deleted without actually deleting',
        example: true
    })
    @ApiResponse({ status: 200, description: 'Cleanup completed or simulated' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
    async cleanupOrphans(
        @Query('dryRun', new DefaultValuePipe(true), ParseBoolPipe) dryRun: boolean,
    ) {
        return this.fileCleanupService.cleanupOrphanFiles(dryRun);
    }

    @Delete('orphans/cleanup-immediate')
    @Throttle({ short: { limit: 1, ttl: 300000 } }) // 1 req/5min
    @ApiOperation({
        summary: 'Cleanup orphan files immediately',
        description: 'Delete ALL orphan files immediately without dry run. USE WITH CAUTION! (Admin only)',
    })
    @ApiResponse({ status: 200, description: 'Immediate cleanup completed' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
    async cleanupOrphansImmediate() {
        return this.fileCleanupService.cleanupOrphansImmediate();
    }

    @Get('integrity/check')
    @Throttle({ medium: { limit: 10, ttl: 60000 } }) // 10 req/min
    @ApiOperation({
        summary: 'Check file integrity',
        description: 'Find database records that reference missing files (Admin only)',
    })
    @ApiResponse({ status: 200, description: 'Integrity check completed' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
    async checkIntegrity() {
        const missingFiles = await this.fileCleanupService.findMissingFiles();

        return {
            missingFiles,
            summary: {
                totalCount: missingFiles.length,
                byType: {
                    pages: missingFiles.filter(f => f.entityType === 'page').length,
                    covers: missingFiles.filter(f => f.entityType === 'cover').length,
                },
            },
        };
    }

    @Delete('old-deleted/cleanup')
    @Throttle({ short: { limit: 1, ttl: 300000 } }) // 1 req/5min
    @ApiOperation({
        summary: 'Cleanup old deleted files',
        description: 'Permanently delete files from entities deleted more than configured retention days ago (Admin only)',
    })
    @ApiResponse({ status: 200, description: 'Old deleted files cleanup completed' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
    async cleanupOldDeletedFiles() {
        return this.fileCleanupService.cleanupOldDeletedFiles();
    }

    @Get('stats')
    @Throttle({ long: { limit: 100, ttl: 60000 } }) // 100 req/min
    @ApiOperation({
        summary: 'Get storage statistics',
        description: 'Retrieve comprehensive storage usage statistics (Admin only)',
    })
    @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
    async getStorageStats() {
        return this.fileCleanupService.getStorageStatistics();
    }
}
