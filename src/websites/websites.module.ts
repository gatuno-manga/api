import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthModule } from '@auth/auth.module';
import { AppConfigModule } from '@app-config/app-config.module';
import { AppConfigService } from '@app-config/app-config.service';
import { Website } from './infrastructure/database/entities/website.entity';
import { WebsiteController } from './infrastructure/http/controllers/website.controller';
import { WebsiteService } from './application/services/website.service';
import { I_WEBSITE_REPOSITORY } from './application/ports/website-repository.interface';
import { TypeOrmWebsiteRepositoryAdapter } from './infrastructure/database/adapters/typeorm-website-repository.adapter';

@Module({
	controllers: [WebsiteController],
	providers: [
		{
			provide: I_WEBSITE_REPOSITORY,
			useClass: TypeOrmWebsiteRepositoryAdapter,
		},
		WebsiteService,
	],
	exports: [I_WEBSITE_REPOSITORY, WebsiteService, ClientsModule],
	imports: [
		AuthModule,
		AppConfigModule,
		TypeOrmModule.forFeature([Website]),
		ClientsModule.registerAsync([
			{
				name: 'SCRAPER_SERVICE',
				imports: [AppConfigModule],
				inject: [AppConfigService],
				useFactory: (configService: AppConfigService) => ({
					transport: Transport.KAFKA,
					options: {
						client: {
							clientId: 'gatuno-api',
							brokers: [configService.kafkaBroker],
						},
						consumer: {
							groupId: 'scraper-consumer',
						},
					},
				}),
			},
		]),
	],
})
export class WebsitesModule {}
