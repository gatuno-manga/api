import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { AppConfigModule } from 'src/app-config/app-config.module';

@Module({
	providers: [FilesService],
	imports: [AppConfigModule],
	exports: [FilesService],
})
export class FilesModule {}
