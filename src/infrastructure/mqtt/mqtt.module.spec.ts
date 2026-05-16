import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { MqttModule } from './mqtt.module';

describe('MqttModule', () => {
	let module: TestingModule;

	beforeEach(async () => {
		module = await Test.createTestingModule({
			imports: [
				ConfigModule.forRoot({
					isGlobal: true,
					load: [
						() => ({
							NANOMQ_HOST: 'localhost',
							NANOMQ_PORT: 1883,
						}),
					],
				}),
				MqttModule,
			],
		}).compile();
	});

	it('should be defined', () => {
		const mqttModule = module.get<MqttModule>(MqttModule);
		expect(mqttModule).toBeDefined();
	});

	it('should provide MQTT_CLIENT', () => {
		const mqttClient = module.get('MQTT_CLIENT');
		expect(mqttClient).toBeDefined();
	});
});
