import { GetFavoritesUseCase } from '@/interactions/application/use-cases/get-favorites.use-case';
import { CurrentUserDto } from '@auth/application/dto/current-user.dto';
import { CurrentUser } from '@auth/infrastructure/framework/current-user.decorator';
import { JwtAuthGuard } from '@auth/infrastructure/framework/jwt-auth.guard';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { DataEnvelopeInterceptor } from '@common/interceptors/data-envelope.interceptor';
import { SWAGGER_AUTH_SCHEME } from '@common/swagger/swagger-auth.constants';
import {
	Controller,
	Get,
	Query,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CursorPageDto } from 'src/common/pagination/cursor-page.dto';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import { FavoritesCursorOptionsDto } from '../http/dto/favorites-cursor-options.dto';
import { ApiDocsGetFavorites } from './swagger/interactions.swagger';

@ApiTags('Interactions')
@Controller('interactions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(DataEnvelopeInterceptor)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class UserInteractionsController {
	constructor(private readonly getFavoritesUseCase: GetFavoritesUseCase) {}

	@Get('favorites')
	@Permissions(PermissionsEnum.INTERACTIONS_MANAGE)
	@ApiDocsGetFavorites()
	async getFavorites(
		@CurrentUser() user: CurrentUserDto,
		@Query() options: FavoritesCursorOptionsDto,
	) {
		const userId = UserId.create(user.userId);
		const page = await this.getFavoritesUseCase.execute(
			userId,
			options.limit,
			options.cursor,
		);

		return new CursorPageDto(
			page.data.map((f) => f.toSnapshot()),
			page.nextCursor,
			page.hasNextPage,
		);
	}
}
