import { Module } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from '@app-config/app-config.module';
import { AppConfigService } from '@app-config/app-config.service';
import { CustomLogger } from '@/custom.logger';
import { LoggerRuleEngine } from './logger-rule-engine';

@Module({
	imports: [
		LoggerModule.forRootAsync({
			imports: [AppConfigModule],
			inject: [AppConfigService],
			useFactory: (config: AppConfigService) => {
				const isProduction = config.nodeEnv === 'production';

				return {
					pinoHttp: {
						level: 'trace',
						genReqId: (req) =>
							req.headers['x-correlation-id'] ||
							req.headers['x-request-id'] ||
							uuidv7(),

						transport: isProduction
							? undefined
							: {
									target: 'pino-pretty',
									options: {
										colorize: true,
										translateTime: 'SYS:HH:MM:ss.l',
										ignore: 'pid,hostname',
										singleLine: false,
										messageFormat: '[{context}] {msg}',
									},
								},

						serializers: {
							req: (req) => ({
								id: req.id,
								method: req.method,
								url: req.url,
								query: req.query,
								params: req.params,
								headers: req.headers,
								body: req.raw?.body || req.body,
								remoteAddress: req.remoteAddress,
								remotePort: req.remotePort,
							}),
							res: (res) => ({
								statusCode: res.statusCode,
							}),
							err: (err) => ({
								type: err.type,
								message: err.message,
								stack: err.stack,
								code: err.code,
								statusCode: err.statusCode,
							}),
						},

						customLogLevel: (req, res, err) => {
							if (res.statusCode >= 400 && res.statusCode < 500) {
								return 'warn';
							}
							if (res.statusCode >= 500 || err) {
								return 'error';
							}
							if (res.statusCode >= 300 && res.statusCode < 400) {
								return 'silent';
							}
							return 'info';
						},

						base: {
							app: 'gatuno-api',
							environment: config.nodeEnv,
							pid: process.pid,
						},

						timestamp: () =>
							`,"timestamp":"${new Date().toISOString()}"`,

						redact: {
							paths: config.logRedactPaths,
							remove: false,
						},

						autoLogging: {
							ignore: (req) => {
								const url = req.url || '';
								const isHealthOrMetrics =
									url === '/health' ||
									url === '/health/liveness' ||
									url === '/health/readiness' ||
									url === '/metrics' ||
									url === '/api/health' ||
									url === '/api/health/liveness' ||
									url === '/api/health/readiness' ||
									url === '/api/metrics';

								if (isHealthOrMetrics) return true;

								// Apply sampling to other requests
								if (config.logSamplingRate < 1.0) {
									return (
										Math.random() > config.logSamplingRate
									);
								}

								return false;
							},
						},
					},
				};
			},
		}),
		AppConfigModule,
	],
	providers: [
		{
			provide: LoggerRuleEngine,
			useFactory: (config: AppConfigService) => {
				return new LoggerRuleEngine(
					config.LogLevel,
					config.logSamplingRate,
				);
			},
			inject: [AppConfigService],
		},
		CustomLogger,
	],
	exports: [LoggerModule, CustomLogger],
})
export class LoggingModule {}
