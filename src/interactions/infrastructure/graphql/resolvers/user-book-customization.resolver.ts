import { CustomizeUserBookUseCase } from '@/interactions/application/use-cases/customize-user-book.use-case';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { GqlCurrentUser } from 'src/auth/infrastructure/framework/gql-current-user.decorator';
import { GqlJwtAuthGuard } from 'src/auth/infrastructure/framework/gql-jwt-auth.guard';
import { DataEnvelopeInterceptor } from 'src/common/interceptors/data-envelope.interceptor';
import { UserBookCustomizationModel } from '../models/user-book-customization.model';

@Resolver(() => UserBookCustomizationModel)
@UseInterceptors(DataEnvelopeInterceptor)
export class UserBookCustomizationResolver {
	constructor(
		private readonly customizeUserBookUseCase: CustomizeUserBookUseCase,
	) {}

	@Mutation(() => UserBookCustomizationModel)
	@UseGuards(GqlJwtAuthGuard)
	async customizeBook(
		@GqlCurrentUser() user: CurrentUserDto,
		@Args('bookId') bookId: string,
		@Args('customTitle', { nullable: true }) customTitle?: string,
		@Args('customCoverUrl', { nullable: true }) customCoverUrl?: string,
	) {
		const result = await this.customizeUserBookUseCase.execute({
			userId: user.userId,
			bookId,
			customTitle,
			customCoverUrl,
		});

		return result.toSnapshot();
	}
}
