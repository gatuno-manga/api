import { AuthModule } from '@auth/auth.module';
import { BooksModule } from '@books/books.module';
import { Module, forwardRef } from '@nestjs/common';
import { UsersModule } from '@users/users.module';
import { SyncRegistry } from './application/services/sync.registry';
import { ProcessSyncUseCase } from './application/use-cases/process-sync.use-case';
import { SyncResolver } from './infrastructure/graphql/resolvers/sync.resolver';
import { SyncController } from './infrastructure/http/sync.controller';

@Module({
	imports: [
		forwardRef(() => UsersModule),
		forwardRef(() => BooksModule),
		forwardRef(() => AuthModule),
	],
	controllers: [SyncController],
	providers: [ProcessSyncUseCase, SyncResolver, SyncRegistry],
	exports: [SyncRegistry],
})
export class SyncModule {}
