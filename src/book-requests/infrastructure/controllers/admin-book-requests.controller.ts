import { RejectBookRequestDto } from '@/book-requests/application/dto/reject-book-request.dto';
import { BookRequestsService } from '@/book-requests/application/use-cases/book-requests.service';
import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import { mapBookRequestToResponseDtoList } from './book-request-http.mapper';
import {
	ApiDocsApprove,
	ApiDocsListAll,
	ApiDocsReject,
} from './swagger/admin-book-requests.swagger';

@ApiTags('Book Requests Admin')
@Controller('admin/book-requests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Roles(RolesEnum.ADMIN)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class AdminBookRequestsController {
	constructor(private readonly bookRequestsService: BookRequestsService) {}

	@Get()
	@Permissions(PermissionsEnum.BOOK_REQUESTS_VIEW_INTERNAL)
	@ApiDocsListAll()
	async listAll() {
		const requests = await this.bookRequestsService.listAll();
		return mapBookRequestToResponseDtoList(requests);
	}

	@Patch(':id/approve')
	@Permissions(PermissionsEnum.BOOK_REQUESTS_MANAGE)
	@ApiDocsApprove()
	async approve(
		@Param('id') id: string,
		@CurrentUser() admin: CurrentUserDto,
	) {
		await this.bookRequestsService.approve(id, admin.userId);
		return { message: 'Book request approved successfully' };
	}

	@Patch(':id/reject')
	@Permissions(PermissionsEnum.BOOK_REQUESTS_MANAGE)
	@ApiDocsReject()
	async reject(
		@Param('id') id: string,
		@Body() dto: RejectBookRequestDto,
		@CurrentUser() admin: CurrentUserDto,
	) {
		await this.bookRequestsService.reject(id, admin.userId, dto);
		return { message: 'Book request rejected successfully' };
	}
}
