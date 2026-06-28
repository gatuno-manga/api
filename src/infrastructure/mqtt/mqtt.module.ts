import { AppConfigModule } from '@/infrastructure/app-config/app-config.module';
import { AppConfigService } from '@/infrastructure/app-config/app-config.service';
import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Global()
@Module({
	imports: [
		AppConfigModule,
		ClientsModule.registerAsync([
			{
				name: 'MQTT_CLIENT',
				imports: [AppConfigModule],
				useFactory: (appConfigService: AppConfigService) => ({
					transport: Transport.MQTT,
					options: {
						url: `mqtt://${appConfigService.nanomq.host}:${appConfigService.nanomq.port}`,
						username: 'internal-system',
						password: appConfigService.jwt.accessSecret,
					},
				}),
				inject: [AppConfigService],
			},
		]),
	],
	exports: [ClientsModule],
})
export class MqttModule {}
