import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Author } from '../books/entities/author.entity';
import { Book } from '../books/entities/book.entity';
import { Chapter } from '../books/entities/chapter.entity';
import { Page } from '../books/entities/page.entity';
import { SensitiveContent } from '../books/entities/sensitive-content.entity';
import { Tag } from '../books/entities/tags.entity';
import { User } from '../users/entities/user.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

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
	providers: [DashboardService],
})
export class DashboardModule {}
