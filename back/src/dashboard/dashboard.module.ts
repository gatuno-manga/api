import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Author } from '../books/entitys/author.entity';
import { Book } from '../books/entitys/book.entity';
import { Chapter } from '../books/entitys/chapter.entity';
import { Page } from '../books/entitys/page.entity';
import { SensitiveContent } from '../books/entitys/sensitive-content.entity';
import { Tag } from '../books/entitys/tags.entity';
import { User } from '../users/entitys/user.entity';
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
