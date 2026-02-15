import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { AppConfigService } from 'src/app-config/app-config.service';
import { AuthModule } from 'src/auth/auth.module';
import { FilesModule } from 'src/files/files.module';
import { RedisModule } from 'src/redis';
import { PlaywrightBrowserFactory } from './browser';
import { Website } from './entities/website.entity';
import { BrowserPoolService } from './pool';
import { ScrapingService } from './scraping.service';
import { WebsiteController } from './website.controller';
import { WebsiteService } from './website.service';

@Module({
	controllers: [WebsiteController],
	providers: [
		// Browser Pool Service
		{
			provide: BrowserPoolService,
			useFactory: (appConfigService: AppConfigService) => {
				const poolConfig = appConfigService.browserPool;
				const { debugMode, slowMo, wsEndpoint } =
					appConfigService.playwright;

				const browserConfig = {
					headless: !debugMode,
					debugMode,
					slowMo,
					wsEndpoint,
					navigationTimeout: 150000,
					actionTimeout: 30000,
					userAgent:
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
					viewport: { width: 1920, height: 1080 },
					downloadDir: '/usr/src/app/data',
					stealth: true,
					locale: 'pt-BR',
					timezoneId: 'America/Sao_Paulo',
				} satisfies Required<BrowserConfig>;

				return new BrowserPoolService(poolConfig, browserConfig);
			},
			inject: [AppConfigService],
		},
		// Playwright Browser Factory
		{
			provide: PlaywrightBrowserFactory,
			useFactory: (
				appConfigService: AppConfigService,
				browserPool: BrowserPoolService,
			) => {
				const { debugMode, slowMo, wsEndpoint } =
					appConfigService.playwright;

				const factory = new PlaywrightBrowserFactory({
					headless: !debugMode,
					debugMode,
					slowMo,
					wsEndpoint,
					downloadDir: '/usr/src/app/data',
				});

				// Integrate with pool if enabled
				if (appConfigService.browserPool.enabled) {
					factory.setBrowserPool(browserPool);
				}

				return factory;
			},
			inject: [AppConfigService, BrowserPoolService],
		},
		ScrapingService,
		WebsiteService,
	],
	exports: [ScrapingService, PlaywrightBrowserFactory],
	imports: [
		AppConfigModule,
		FilesModule,
		AuthModule,
		RedisModule,
		TypeOrmModule.forFeature([Website]),
	],
})
export class ScrapingModule {}
