import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BooksModule } from '../books/books.module';
import { UsersModule } from '../users/users.module';
import { ProcessSyncUseCase } from './application/use-cases/process-sync.use-case';
import { SyncResolver } from './infrastructure/graphql/resolvers/sync.resolver';
import { SyncController } from './infrastructure/http/sync.controller';

@Module({
	imports: [UsersModule, BooksModule, AuthModule],
	controllers: [SyncController],
	providers: [ProcessSyncUseCase, SyncResolver],
})
export class SyncModule {}
