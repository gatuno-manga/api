import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from '../app-config/app-config.module';
import { AppConfigService } from '../app-config/app-config.service';
import { CustomLogger } from '../custom.logger';

@Module({
	imports: [
		LoggerModule.forRootAsync({
			imports: [AppConfigModule],
			inject: [AppConfigService],
			useFactory: (config: AppConfigService) => {
				const isProduction = config.nodeEnv === 'production';

				return {
					pinoHttp: {
						level: isProduction ? 'info' : 'debug',

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
								headers: {
									host: req.headers.host,
									'user-agent': req.headers['user-agent'],
									'content-type': req.headers['content-type'],
								},
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
							paths: [
								'req.headers.authorization',
								'req.headers.cookie',
								'req.body.password',
								'req.body.token',
								'res.headers["set-cookie"]',
							],
							remove: true,
						},

						autoLogging: {
							ignore: (req) => {
								return (
									req.url === '/health' ||
									req.url === '/health/liveness' ||
									req.url === '/health/readiness' ||
									req.url === '/metrics'
								);
							},
						},
					},
				};
			},
		}),
		AppConfigModule,
	],
	providers: [CustomLogger],
	exports: [LoggerModule, CustomLogger],
})
export class LoggingModule {}
