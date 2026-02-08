import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { AuthModule } from 'src/auth/auth.module';
import { FilesModule } from 'src/files/files.module';
import { RedisModule } from 'src/redis';
import { Website } from './entitys/website.entity';
import { ScrapingService } from './scraping.service';
import { WebsiteController } from './website.controller';
import { WebsiteService } from './website.service';

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
