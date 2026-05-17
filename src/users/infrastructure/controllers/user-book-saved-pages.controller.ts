import {
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SavedPagesService } from '@users/application/use-cases/saved-pages.service';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { DataEnvelopeInterceptor } from 'src/common/interceptors/data-envelope.interceptor';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { ApiDocsGetSavedPagesByBook } from './swagger/user-book-saved-pages.swagger';

@ApiTags('Saved Pages')
@Controller('users/me/books')
@UseGuards(JwtAuthGuard)
@UseInterceptors(DataEnvelopeInterceptor)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class UserBookSavedPagesController {
	constructor(private readonly savedPagesService: SavedPagesService) {}

	@Get(':bookId/saved-pages')
	@ApiDocsGetSavedPagesByBook()
	async getSavedPagesByBook(
		@Param('bookId', ParseUUIDPipe) bookId: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.savedPagesService.getSavedPagesByBook(user.userId, bookId);
	}
}
