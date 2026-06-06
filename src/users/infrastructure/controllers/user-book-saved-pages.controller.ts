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
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import { ApiDocsGetSavedPagesByBook } from './swagger/user-book-saved-pages.swagger';

@ApiTags('Saved Pages')
@Controller('users/me/books')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(DataEnvelopeInterceptor)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class UserBookSavedPagesController {
	constructor(private readonly savedPagesService: SavedPagesService) {}

	@Get(':bookId/saved-pages')
	@Permissions(PermissionsEnum.SAVED_PAGES_MANAGE)
	@ApiDocsGetSavedPagesByBook()
	async getSavedPagesByBook(
		@Param('bookId', ParseUUIDPipe) bookId: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.savedPagesService.getSavedPagesByBook(user.userId, bookId);
	}
}
