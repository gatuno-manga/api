import { Global, Logger, Module } from '@nestjs/common';
import { Meilisearch } from 'meilisearch';
import { AppConfigModule } from '@app-config/app-config.module';
import { AppConfigService } from '@app-config/app-config.service';
import { MEILI_CLIENT } from './meilisearch.constants';
import { MeilisearchIndexInitService } from './meilisearch-index-init.service';

@Global()
@Module({
	imports: [AppConfigModule],
	providers: [
		{
			provide: MEILI_CLIENT,
			useFactory: (configService: AppConfigService) => {
				const logger = new Logger('MeilisearchClient');
				const { host, masterKey } = configService.meili;

				logger.log(`Connecting to Meilisearch at ${host}...`);

				try {
					const client = new Meilisearch({
						host,
						apiKey: masterKey,
					});
					return client;
				} catch (error) {
					logger.error(`❌ Meilisearch error: ${error.message}`);
					throw error;
				}
			},
			inject: [AppConfigService],
		},
		MeilisearchIndexInitService,
	],
	exports: [MEILI_CLIENT],
})
export class MeilisearchModule {}
