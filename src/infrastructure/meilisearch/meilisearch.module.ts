import { AppConfigModule } from '@app-config/app-config.module';
import { AppConfigService } from '@app-config/app-config.service';
import { Global, Logger, Module } from '@nestjs/common';
import { Meilisearch } from 'meilisearch';
import { MeilisearchIndexInitService } from './meilisearch-index-init.service';
import { MEILI_CLIENT } from './meilisearch.constants';

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
				} catch (error: unknown) {
					logger.error(
						`❌ Meilisearch error: ${error instanceof Error ? error.message : String(error)}`,
					);
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
