import {
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { DataEnvelopeInterceptor } from 'src/common/interceptors/data-envelope.interceptor';
import { SavedPagesService } from './saved-pages/saved-pages.service';

@ApiTags('Saved Pages')
@Controller('users/me/books')
@UseGuards(JwtAuthGuard)
@UseInterceptors(DataEnvelopeInterceptor)
@ApiBearerAuth('JWT-auth')
export class UserBookSavedPagesController {
	constructor(private readonly savedPagesService: SavedPagesService) {}

	@Get(':bookId/saved-pages')
	@ApiOperation({
		summary: 'Get saved pages for a specific book',
		description:
			'Retrieve all saved pages of the current user for a specific book',
	})
	@ApiParam({
		name: 'bookId',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({
		status: 200,
		description: 'Saved pages for the book retrieved successfully',
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async getSavedPagesByBook(
		@Param('bookId', ParseUUIDPipe) bookId: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.savedPagesService.getSavedPagesByBook(user.userId, bookId);
	}
}
