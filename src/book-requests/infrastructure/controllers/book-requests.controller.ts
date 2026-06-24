import { CreateBookRequestDto } from '@/book-requests/application/dto/create-book-request.dto';
import { BookRequestsService } from '@/book-requests/application/use-cases/book-requests.service';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import { mapBookRequestToResponseDtoList } from './book-request-http.mapper';
import {
	ApiDocsCreate,
	ApiDocsListMyRequests,
} from './swagger/book-requests.swagger';

@ApiTags('Book Requests')
@Controller('book-requests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class BookRequestsController {
	constructor(private readonly bookRequestsService: BookRequestsService) {}

	@Post()
	@Permissions(PermissionsEnum.BOOK_REQUESTS_CREATE)
	@ApiDocsCreate()
	async create(
		@Body() dto: CreateBookRequestDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		const { id } = await this.bookRequestsService.create(dto, user.userId);
		return { id, message: 'Book request submitted successfully' };
	}

	@Get('me')
	@Permissions(PermissionsEnum.BOOK_REQUESTS_VIEW_OWN)
	@ApiDocsListMyRequests()
	async listMyRequests(@CurrentUser() user: CurrentUserDto) {
		const requests = await this.bookRequestsService.listMyRequests(
			user.userId,
		);
		return mapBookRequestToResponseDtoList(requests);
	}
}
