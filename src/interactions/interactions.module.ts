import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { FavoriteEntity } from './infrastructure/database/entities/favorite.entity';
import { SubscriptionEntity } from './infrastructure/database/entities/subscription.entity';
import { ReviewEntity } from './infrastructure/database/entities/review.entity';
import { TypeOrmFavoriteRepository } from './infrastructure/database/repositories/typeorm-favorite.repository';
import { TypeOrmSubscriptionRepository } from './infrastructure/database/repositories/typeorm-subscription.repository';
import { TypeOrmReviewRepository } from './infrastructure/database/repositories/typeorm-review.repository';
import { FavoriteBookUseCase } from './application/use-cases/favorite-book.use-case';
import { SubscribeToBookUseCase } from './application/use-cases/subscribe-to-book.use-case';
import { ReviewBookUseCase } from './application/use-cases/review-book.use-case';
import { NotificationEvents } from './infrastructure/events/notification.events';
import { InteractionsController } from './infrastructure/controllers/interactions.controller';

@Module({
	imports: [
		AuthModule,
		TypeOrmModule.forFeature([
			FavoriteEntity,
			SubscriptionEntity,
			ReviewEntity,
		]),
	],
	controllers: [InteractionsController],
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
