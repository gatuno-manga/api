import { AuthModule } from '@auth/auth.module';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '@users/users.module';
import { I_BOOK_REQUEST_REPOSITORY } from './application/ports/book-request.repository';
import { BookRequestsService } from './application/use-cases/book-requests.service';
import { AdminBookRequestsController } from './infrastructure/controllers/admin-book-requests.controller';
import { BookRequestsController } from './infrastructure/controllers/book-requests.controller';
import { TypeOrmBookRequestRepository } from './infrastructure/database/adapters/typeorm-book-request.repository';
import { BookRequestEntity } from './infrastructure/database/entities/book-request.entity';
import { BookRequestsNotifier } from './infrastructure/notifiers/book-requests.notifier';

@Module({
	imports: [
		TypeOrmModule.forFeature([BookRequestEntity]),
		forwardRef(() => AuthModule),
		forwardRef(() => UsersModule),
	],
	providers: [
		BookRequestsService,
		{
			provide: I_BOOK_REQUEST_REPOSITORY,
			useClass: TypeOrmBookRequestRepository,
		},
		BookRequestsNotifier,
	],
	controllers: [BookRequestsController, AdminBookRequestsController],
	exports: [BookRequestsService],
})
export class BookRequestsModule {}
