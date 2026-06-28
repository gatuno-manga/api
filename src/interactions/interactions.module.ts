import { BooksModule } from '@/books/books.module';
import { SyncModule } from '@/sync/sync.module';
import { AuthModule } from '@auth/auth.module';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '@users/users.module';
import { FavoritesSyncProvider } from './application/providers/favorites-sync.provider';
import { FavoriteBookUseCase } from './application/use-cases/favorite-book.use-case';
import { GetFavoritesForSyncUseCase } from './application/use-cases/get-favorites-for-sync.use-case';
import { GetFavoritesUseCase } from './application/use-cases/get-favorites.use-case';
import { GetMqttTopicsUseCase } from './application/use-cases/get-mqtt-topics.use-case';
import { ReviewBookUseCase } from './application/use-cases/review-book.use-case';
import { SubscribeToBookUseCase } from './application/use-cases/subscribe-to-book.use-case';
import { UnfavoriteBookUseCase } from './application/use-cases/unfavorite-book.use-case';
import { InteractionsController } from './infrastructure/controllers/interactions.controller';
import { UserInteractionsController } from './infrastructure/controllers/user-interactions.controller';
import { FavoriteEntity } from './infrastructure/database/entities/favorite.entity';
import { ReviewEntity } from './infrastructure/database/entities/review.entity';
import { SubscriptionEntity } from './infrastructure/database/entities/subscription.entity';
import { TypeOrmFavoriteRepository } from './infrastructure/database/repositories/typeorm-favorite.repository';
import { TypeOrmReviewRepository } from './infrastructure/database/repositories/typeorm-review.repository';
import { TypeOrmSubscriptionRepository } from './infrastructure/database/repositories/typeorm-subscription.repository';
import { NotificationEvents } from './infrastructure/events/notification.events';
import { FavoriteResolver } from './infrastructure/graphql/resolvers/favorite.resolver';

@Module({
	imports: [
		forwardRef(() => AuthModule),
		forwardRef(() => UsersModule),
		forwardRef(() => BooksModule),
		forwardRef(() => SyncModule),
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
		UnfavoriteBookUseCase,
		GetFavoritesForSyncUseCase,
		GetFavoritesUseCase,
		GetMqttTopicsUseCase,
		SubscribeToBookUseCase,
		ReviewBookUseCase,
		FavoritesSyncProvider,
		NotificationEvents,
		FavoriteResolver,
	],
	exports: [
		'FavoriteRepository',
		'SubscriptionRepository',
		'ReviewRepository',
		FavoriteBookUseCase,
		UnfavoriteBookUseCase,
		GetFavoritesForSyncUseCase,
	],
})
export class InteractionsModule {}
