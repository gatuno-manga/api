import { Module } from '@nestjs/common';
import { ScrapingService } from './scraping.service';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { FilesModule } from 'src/files/files.module';

@Module({
	providers: [ScrapingService],
	exports: [ScrapingService],
	imports: [AppConfigModule, FilesModule],
})
export class ScrapingModule {}
