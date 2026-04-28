import {
	Body,
	Controller,
	Post,
	UseGuards,
	UseInterceptors,
	Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/framework/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/framework/current-user.decorator';
import { CurrentUserDto } from '../../../auth/application/dto/current-user.dto';
import { DataEnvelopeInterceptor } from '../../../common/interceptors/data-envelope.interceptor';
import { FavoriteBookUseCase } from '../../application/use-cases/favorite-book.use-case';
import { SubscribeToBookUseCase } from '../../application/use-cases/subscribe-to-book.use-case';
import { ReviewBookUseCase } from '../../application/use-cases/review-book.use-case';
import { ReviewBookDto } from '../http/dto/review-book.dto';
import { SWAGGER_AUTH_SCHEME } from '../../../common/swagger/swagger-auth.constants';

@ApiTags('Interactions')
@Controller('books/:id')
@UseGuards(JwtAuthGuard)
@UseInterceptors(DataEnvelopeInterceptor)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class InteractionsController {
	constructor(
		private readonly favoriteUseCase: FavoriteBookUseCase,
		private readonly subscribeUseCase: SubscribeToBookUseCase,
		private readonly reviewUseCase: ReviewBookUseCase,
	) {}

	@Post('favorite')
	@ApiOperation({ summary: 'Mark book as favorite' })
	async favorite(
		@CurrentUser() user: CurrentUserDto,
		@Param('id') id: string,
	) {
		return this.favoriteUseCase.execute(user.userId, id);
	}

	@Post('subscribe')
	@ApiOperation({ summary: 'Subscribe to book updates' })
	async subscribe(
		@CurrentUser() user: CurrentUserDto,
		@Param('id') id: string,
	) {
		return this.subscribeUseCase.execute(user.userId, id);
	}

	@Post('reviews')
	@ApiOperation({ summary: 'Review and rate a book' })
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
