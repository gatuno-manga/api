import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { BookRequestsService } from '@/book-requests/application/use-cases/book-requests.service';
import { CreateBookRequestDto } from '@/book-requests/application/dto/create-book-request.dto';
import { mapBookRequestToResponseDtoList } from './book-request-http.mapper';
import {
	ApiDocsCreate,
	ApiDocsListMyRequests,
} from './swagger/book-requests.swagger';

@ApiTags('Book Requests')
@Controller('book-requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class BookRequestsController {
	constructor(private readonly bookRequestsService: BookRequestsService) {}

	@Post()
	@ApiDocsCreate()
	async create(
		@Body() dto: CreateBookRequestDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		await this.bookRequestsService.create(dto, user.userId);
		return { message: 'Book request submitted successfully' };
	}

	@Get('me')
	@ApiDocsListMyRequests()
	async listMyRequests(@CurrentUser() user: CurrentUserDto) {
		const requests = await this.bookRequestsService.listMyRequests(
			user.userId,
		);
		return mapBookRequestToResponseDtoList(requests);
	}
}
