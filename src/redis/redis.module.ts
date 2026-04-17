import { Global, Logger, Module } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { AppConfigService } from 'src/app-config/app-config.service';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

@Global()
@Module({
	imports: [AppConfigModule],
	providers: [
		{
			provide: REDIS_CLIENT,
			useFactory: (configService: AppConfigService) => {
				const logger = new Logger('RedisClient');
				const { host, port, password } = configService.redis;

				logger.log(`Connecting to Redis at ${host}:${port}...`);

				const redis = new Redis({
					host,
					port,
					password: password || undefined,

					// Timeouts
					connectTimeout: 10000, // 10s para estabelecer conexão
					commandTimeout: 30000, // 30s para executar comandos

					// Keep-alive
					keepAlive: 30000, // 30s entre keep-alive packets

					// Retry Strategy
					maxRetriesPerRequest: 3,
					retryStrategy: (times: number) => {
						if (times > 10) {
							logger.error(
								'Max retry attempts reached. Stopping reconnection.',
							);
							return null;
						}
						const delay = Math.min(times * 50, 2000);
						logger.warn(
							`Retrying connection in ${delay}ms (attempt ${times})`,
						);
						return delay;
					},

					// Reconnect
					enableReadyCheck: true,
					enableOfflineQueue: true,
					lazyConnect: false,

					reconnectOnError: (err: Error) => {
						const targetErrors = [
							'READONLY',
							'ECONNRESET',
							'ETIMEDOUT',
						];
						if (
							targetErrors.some((target) =>
								err.message.includes(target),
							)
						) {
							logger.warn(
								`Reconnecting due to error: ${err.message}`,
							);
							return true;
						}
						return false;
					},

					// Configurações adicionais para estabilidade
					showFriendlyErrorStack: true,
					enableAutoPipelining: true,
				});

				// Event handlers
				redis.on('connect', () => {
					logger.log('📡 Redis connecting...');
				});

				redis.on('ready', () => {
					logger.log('✅ Redis connection ready');
				});

				redis.on('error', (err: Error) => {
					logger.error(`❌ Redis error: ${err.message}`);
				});

				redis.on('close', () => {
					logger.warn('🔌 Redis connection closed');
				});

				redis.on('reconnecting', (time: number) => {
					logger.log(`🔄 Redis reconnecting in ${time}ms...`);
				});

				redis.on('end', () => {
					logger.warn('⛔ Redis connection ended');
				});

				return redis;
			},
			inject: [AppConfigService],
		},
		RedisService,
	],
	exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
