import { Module } from '@nestjs/common';
import { ScrapingService } from './scraping.service';
import { AppConfigModule } from 'src/app-config/app-config.module';

@Module({
	providers: [ScrapingService],
	exports: [ScrapingService],
	imports: [AppConfigModule],
})
export class ScrapingModule {}
