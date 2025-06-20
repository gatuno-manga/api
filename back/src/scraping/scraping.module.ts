import { Module } from '@nestjs/common';
import { ScrapingService } from './scraping.service';

@Module({
	providers: [ScrapingService],
	exports: [ScrapingService],
})
export class ScrapingModule {}
