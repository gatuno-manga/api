import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { BookRequestEntity } from './infrastructure/database/entities/book-request.entity';
import { BookRequestsService } from './application/use-cases/book-requests.service';
import { I_BOOK_REQUEST_REPOSITORY } from './application/ports/book-request.repository';
import { TypeOrmBookRequestRepository } from './infrastructure/database/adapters/typeorm-book-request.repository';
import { BookRequestsController } from './infrastructure/controllers/book-requests.controller';
import { AdminBookRequestsController } from './infrastructure/controllers/admin-book-requests.controller';

@Module({
	imports: [TypeOrmModule.forFeature([BookRequestEntity]), AuthModule],
	providers: [
		BookRequestsService,
		{
			provide: I_BOOK_REQUEST_REPOSITORY,
			useClass: TypeOrmBookRequestRepository,
		},
	],
	controllers: [BookRequestsController, AdminBookRequestsController],
	exports: [BookRequestsService],
})
export class BookRequestsModule {}
