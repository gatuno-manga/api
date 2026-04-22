import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Author } from '../books/infrastructure/database/entities/author.entity';
import { Book } from '../books/infrastructure/database/entities/book.entity';
import { Chapter } from '../books/infrastructure/database/entities/chapter.entity';
import { Page } from '../books/infrastructure/database/entities/page.entity';
import { SensitiveContent } from '../books/infrastructure/database/entities/sensitive-content.entity';
import { Tag } from '../books/infrastructure/database/entities/tags.entity';
import { User } from '../users/infrastructure/database/entities/user.entity';
import { DashboardController } from './infrastructure/controllers/dashboard.controller';
import { GetDashboardOverviewUseCase } from './application/use-cases/get-dashboard-overview.use-case';
import { TypeOrmDashboardAdapter } from './infrastructure/database/adapters/typeorm-dashboard.adapter';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			Book,
			Chapter,
			User,
			Page,
			Tag,
			Author,
			SensitiveContent,
		]),
		AuthModule,
	],
	controllers: [DashboardController],
	providers: [
		GetDashboardOverviewUseCase,
		{
			provide: 'DashboardRepositoryPort',
			useClass: TypeOrmDashboardAdapter,
		},
	],
})
export class DashboardModule {}
