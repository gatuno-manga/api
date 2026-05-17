import { AuthModule } from '@auth/auth.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { I_BOOK_REQUEST_REPOSITORY } from './application/ports/book-request.repository';
import { BookRequestsService } from './application/use-cases/book-requests.service';
import { AdminBookRequestsController } from './infrastructure/controllers/admin-book-requests.controller';
import { BookRequestsController } from './infrastructure/controllers/book-requests.controller';
import { TypeOrmBookRequestRepository } from './infrastructure/database/adapters/typeorm-book-request.repository';
import { BookRequestEntity } from './infrastructure/database/entities/book-request.entity';

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
