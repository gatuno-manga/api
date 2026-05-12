import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthModule } from '@auth/auth.module';
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
		TypeOrmModule.forFeature([Website]),
		ClientsModule.register([
			{
				name: 'SCRAPER_SERVICE',
				transport: Transport.KAFKA,
				options: {
					client: {
						clientId: 'gatuno-api',
						brokers: [
							process.env.KAFKA_BROKERS || 'localhost:9092',
						],
					},
					consumer: {
						groupId: 'scraper-consumer',
					},
				},
			},
		]),
	],
})
export class WebsitesModule {}
