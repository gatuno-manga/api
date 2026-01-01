import { Module } from '@nestjs/common';
import { ScrapingService } from './scraping.service';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { FilesModule } from 'src/files/files.module';
import { Website } from './entitys/website.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebsiteService } from './website.service';
import { WebsiteController } from './website.controller';
import { AuthModule } from 'src/auth/auth.module';
import { RedisModule } from 'src/redis';

@Module({
	controllers: [WebsiteController],
	providers: [ScrapingService, WebsiteService],
	exports: [ScrapingService],
	imports: [
		AppConfigModule,
		FilesModule,
		AuthModule,
		RedisModule,
		TypeOrmModule.forFeature([Website]),
	],
})
export class ScrapingModule {}
