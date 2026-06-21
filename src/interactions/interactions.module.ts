import { AuthModule } from '@auth/auth.module';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '@users/users.module';
import { FavoriteBookUseCase } from './application/use-cases/favorite-book.use-case';
import { GetFavoritesUseCase } from './application/use-cases/get-favorites.use-case';
import { ReviewBookUseCase } from './application/use-cases/review-book.use-case';
import { SubscribeToBookUseCase } from './application/use-cases/subscribe-to-book.use-case';
import { InteractionsController } from './infrastructure/controllers/interactions.controller';
import { UserInteractionsController } from './infrastructure/controllers/user-interactions.controller';
import { FavoriteEntity } from './infrastructure/database/entities/favorite.entity';
import { ReviewEntity } from './infrastructure/database/entities/review.entity';
import { SubscriptionEntity } from './infrastructure/database/entities/subscription.entity';
import { TypeOrmFavoriteRepository } from './infrastructure/database/repositories/typeorm-favorite.repository';
import { TypeOrmReviewRepository } from './infrastructure/database/repositories/typeorm-review.repository';
import { TypeOrmSubscriptionRepository } from './infrastructure/database/repositories/typeorm-subscription.repository';
import { NotificationEvents } from './infrastructure/events/notification.events';

@Module({
	imports: [
		forwardRef(() => AuthModule),
		forwardRef(() => UsersModule),
		TypeOrmModule.forFeature([
			FavoriteEntity,
			SubscriptionEntity,
			ReviewEntity,
		]),
	],
	controllers: [InteractionsController, UserInteractionsController],
	providers: [
		{
			provide: 'FavoriteRepository',
			useClass: TypeOrmFavoriteRepository,
		},
		{
			provide: 'SubscriptionRepository',
			useClass: TypeOrmSubscriptionRepository,
		},
		{
			provide: 'ReviewRepository',
			useClass: TypeOrmReviewRepository,
		},
		FavoriteBookUseCase,
		GetFavoritesUseCase,
		SubscribeToBookUseCase,
		ReviewBookUseCase,
		NotificationEvents,
	],
	exports: [
		'FavoriteRepository',
		'SubscriptionRepository',
		'ReviewRepository',
	],
})
export class InteractionsModule {}
