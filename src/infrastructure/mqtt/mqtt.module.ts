import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Global()
@Module({
	imports: [
		ClientsModule.registerAsync([
			{
				name: 'MQTT_CLIENT',
				useFactory: (configService: ConfigService) => ({
					transport: Transport.MQTT,
					options: {
						url: `mqtt://${configService.get('NANOMQ_HOST')}:${configService.get('NANOMQ_PORT')}`,
					},
				}),
				inject: [ConfigService],
			},
		]),
	],
	exports: [ClientsModule],
})
export class MqttModule {}
