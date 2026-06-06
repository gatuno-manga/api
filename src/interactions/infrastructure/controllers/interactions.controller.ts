import { FavoriteBookUseCase } from '@/interactions/application/use-cases/favorite-book.use-case';
import { ReviewBookUseCase } from '@/interactions/application/use-cases/review-book.use-case';
import { SubscribeToBookUseCase } from '@/interactions/application/use-cases/subscribe-to-book.use-case';
import { ReviewBookDto } from '@/interactions/infrastructure/http/dto/review-book.dto';
import { CurrentUserDto } from '@auth/application/dto/current-user.dto';
import { CurrentUser } from '@auth/infrastructure/framework/current-user.decorator';
import { JwtAuthGuard } from '@auth/infrastructure/framework/jwt-auth.guard';
import { DataEnvelopeInterceptor } from '@common/interceptors/data-envelope.interceptor';
import { SWAGGER_AUTH_SCHEME } from '@common/swagger/swagger-auth.constants';
import {
	Body,
	Controller,
	Param,
	Post,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import {
	ApiDocsFavorite,
	ApiDocsReview,
	ApiDocsSubscribe,
} from './swagger/interactions.swagger';

@ApiTags('Interactions')
@Controller('books/:id')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(DataEnvelopeInterceptor)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class InteractionsController {
	constructor(
		private readonly favoriteUseCase: FavoriteBookUseCase,
		private readonly subscribeUseCase: SubscribeToBookUseCase,
		private readonly reviewUseCase: ReviewBookUseCase,
	) {}

	@Post('favorite')
	@Permissions(PermissionsEnum.INTERACTIONS_MANAGE)
	@ApiDocsFavorite()
	async favorite(
		@CurrentUser() user: CurrentUserDto,
		@Param('id') id: string,
	) {
		return this.favoriteUseCase.execute(user.userId, id);
	}

	@Post('subscribe')
	@Permissions(PermissionsEnum.INTERACTIONS_MANAGE)
	@ApiDocsSubscribe()
	async subscribe(
		@CurrentUser() user: CurrentUserDto,
		@Param('id') id: string,
	) {
		return this.subscribeUseCase.execute(user.userId, id);
	}

	@Post('reviews')
	@Permissions(PermissionsEnum.INTERACTIONS_MANAGE)
	@ApiDocsReview()
	async review(
		@CurrentUser() user: CurrentUserDto,
		@Param('id') id: string,
		@Body() dto: ReviewBookDto,
	) {
		return this.reviewUseCase.execute(
			user.userId,
			id,
			dto.rating,
			dto.content,
		);
	}
}
