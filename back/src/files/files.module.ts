import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { SharpAdapter } from './adapters/sharp.adapter';
import { NoCompressionAdapter } from './adapters/no-compression.adapter';
import { FileCompressorFactory } from './factories/file-compressor.factory';

@Module({
	providers: [
		FilesService,
		FileCompressorFactory,
		SharpAdapter,
		NoCompressionAdapter,
		{
			provide: 'FILE_COMPRESSORS',
			useFactory: (
				sharpAdapter: SharpAdapter,
				noCompressionAdapter: NoCompressionAdapter,
			) => {
				return [
					sharpAdapter,
					noCompressionAdapter, // Fallback para outros tipos
				];
			},
			inject: [SharpAdapter, NoCompressionAdapter],
		},
		{
			provide: 'COMPRESSOR_FACTORY_INIT',
			useFactory: (
				factory: FileCompressorFactory,
				compressors: any[],
			) => {
				factory.registerCompressors(compressors);
				return factory;
			},
			inject: [FileCompressorFactory, 'FILE_COMPRESSORS'],
		},
	],
	imports: [AppConfigModule],
	exports: [FilesService],
})
export class FilesModule {}
