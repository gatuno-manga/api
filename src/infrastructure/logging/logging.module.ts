import {
	IncomingHttpHeaders,
	IncomingMessage,
	ServerResponse,
} from 'node:http';
import { CustomLogger } from '@/custom.logger';
import { AppConfigModule } from '@app-config/app-config.module';
import { AppConfigService } from '@app-config/app-config.service';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { v7 as uuidv7 } from 'uuid';
import { LoggerRuleEngine } from './logger-rule-engine';

interface PinoRequest extends IncomingMessage {
	id: string;
	method: string;
	url: string;
	query: Record<string, unknown>;
	params: Record<string, unknown>;
	headers: IncomingHttpHeaders;
	raw?: { body?: unknown };
	body?: unknown;
	remoteAddress: string;
	remotePort: number;
}

interface PinoError extends Error {
	type: string;
	stack: string;
	code: string;
	statusCode: number;
}

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
						genReqId: (req: IncomingMessage) => {
							const headers = req.headers;
							return (
								(headers['x-correlation-id'] as string) ||
								(headers['x-request-id'] as string) ||
								uuidv7()
							);
						},

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
							req: (req: PinoRequest) => {
								return {
									id: req.id,
									method: req.method,
									url: req.url,
									query: req.query,
									params: req.params,
									headers: req.headers,
									body: req.raw?.body || req.body,
									remoteAddress: req.remoteAddress,
									remotePort: req.remotePort,
								};
							},
							res: (res: ServerResponse) => ({
								statusCode: res.statusCode,
							}),
							err: (err: PinoError) => ({
								type: err.type,
								message: err.message,
								stack: err.stack,
								code: err.code,
								statusCode: err.statusCode,
							}),
						},

						customLogLevel: (
							_req: IncomingMessage,
							res: ServerResponse,
							error?: Error,
						) => {
							if (res.statusCode >= 400 && res.statusCode < 500) {
								return 'warn';
							}
							if (res.statusCode >= 500 || error) {
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
							ignore: (req: IncomingMessage) => {
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
					config.logLevel,
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
