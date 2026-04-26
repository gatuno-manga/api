import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { BookRequestsService } from '../../application/use-cases/book-requests.service';
import { RejectBookRequestDto } from '../../application/dto/reject-book-request.dto';
import { mapBookRequestToResponseDtoList } from './book-request-http.mapper';
import { BookRequestResponseDto } from '../http/dto/book-request-response.dto';

@ApiTags('Book Requests Admin')
@Controller('admin/book-requests')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class AdminBookRequestsController {
	constructor(private readonly bookRequestsService: BookRequestsService) {}

	@Get()
	@ApiOperation({
		summary: 'List all book requests',
		description: 'Returns a list of all book requests (Admin only)',
	})
	@ApiResponse({
		status: 200,
		description: 'List of requests',
		type: [BookRequestResponseDto],
	})
	async listAll() {
		const requests = await this.bookRequestsService.listAll();
		return mapBookRequestToResponseDtoList(requests);
	}

	@Patch(':id/approve')
	@ApiOperation({
		summary: 'Approve a book request',
		description: 'Marks a book request as approved (Admin only)',
	})
	@ApiResponse({ status: 200, description: 'Request approved successfully' })
	@ApiResponse({ status: 404, description: 'Request not found' })
	async approve(
		@Param('id') id: string,
		@CurrentUser() admin: CurrentUserDto,
	) {
		await this.bookRequestsService.approve(id, admin.userId);
		return { message: 'Book request approved successfully' };
	}

	@Patch(':id/reject')
	@ApiOperation({
		summary: 'Reject a book request',
		description:
			'Marks a book request as rejected with a reason (Admin only)',
	})
	@ApiResponse({ status: 200, description: 'Request rejected successfully' })
	@ApiResponse({ status: 404, description: 'Request not found' })
	async reject(
		@Param('id') id: string,
		@Body() dto: RejectBookRequestDto,
		@CurrentUser() admin: CurrentUserDto,
	) {
		await this.bookRequestsService.reject(id, admin.userId, dto);
		return { message: 'Book request rejected successfully' };
	}
}
