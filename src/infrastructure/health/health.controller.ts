import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
	DiskHealthIndicator,
	HealthCheck,
	HealthCheckService,
	HttpHealthIndicator,
	MemoryHealthIndicator,
	MicroserviceHealthIndicator,
	TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Redis } from 'ioredis';
import { Transport } from '@nestjs/microservices';
import { REDIS_CLIENT } from '@/infrastructure/redis/redis.constants';
import { AppConfigService } from '@app-config/app-config.service';
import {
	ApiDocsCheck,
	ApiDocsLiveness,
	ApiDocsReadiness,
	ApiDocsStartup,
} from './swagger/health.swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
	constructor(
		private health: HealthCheckService,
		private db: TypeOrmHealthIndicator,
		private memory: MemoryHealthIndicator,
		private disk: DiskHealthIndicator,
		private http: HttpHealthIndicator,
		private microservice: MicroserviceHealthIndicator,
		private appConfig: AppConfigService,
		@Inject(REDIS_CLIENT) private readonly redis: Redis,
	) {}

	@Get()
	@HealthCheck()
	@ApiDocsCheck()
	check() {
		return this.health.check([
			() => this.db.pingCheck('database'),
			// Redis Check
			async () => {
				try {
					const status = await this.redis.ping();
					return {
						redis: { status: status === 'PONG' ? 'up' : 'down' },
					};
				} catch (e) {
					return { redis: { status: 'down', message: e.message } };
				}
			},
			// Kafka Check
			() =>
				this.microservice.pingCheck('kafka', {
					transport: Transport.KAFKA,
					options: {
						client: {
							brokers: [this.appConfig.kafkaBroker],
						},
					},
				}),
			// Meilisearch Check
			() =>
				this.http.pingCheck(
					'meilisearch',
					`${this.appConfig.meili.host}/health`,
				),
			// RustFS Check
			() => this.http.pingCheck('rustfs', this.appConfig.rustfs.endpoint),
			// FlareSolverr Check
			() =>
				this.http.pingCheck(
					'flaresolverr',
					`${this.appConfig.flareSolverrUrl}/health`,
				),
			// Browserless Check (HTTP fallback as WS is harder to ping simply with HttpIndicator)
			() =>
				this.http.pingCheck(
					'browserless',
					this.appConfig.playwright.wsEndpoint.replace(
						'ws://',
						'http://',
					),
				),
			// Memória Detalhada para diagnóstico
			() => {
				const mem = process.memoryUsage();
				const toMB = (bytes: number) =>
					`${(bytes / 1024 / 1024).toFixed(2)} MB`;

				return {
					memory_detail: {
						status: 'up',
						heapUsed: toMB(mem.heapUsed),
						heapTotal: toMB(mem.heapTotal),
						external: toMB(mem.external), // Memória de módulos C++ (Sharp/Images)
						rss: toMB(mem.rss), // Total ocupado no sistema
						arrayBuffers: toMB(mem.arrayBuffers || 0),
					},
				};
			},
			() =>
				this.memory.checkHeap(
					'memory_heap',
					this.appConfig.healthHeapLimitBytes,
				),
			() =>
				this.disk.checkStorage('storage', {
					path: '/usr/src/app/data',
					thresholdPercent: this.appConfig.healthDiskThresholdPercent,
				}),
		]);
	}

	@Get('liveness')
	@HealthCheck()
	@ApiDocsLiveness()
	liveness() {
		return this.health.check([
			() => Promise.resolve({ liveness: { status: 'up' } }),
		]);
	}

	@Get('readiness')
	@HealthCheck()
	@ApiDocsReadiness()
	readiness() {
		return this.health.check([
			() => this.db.pingCheck('database'),
			() =>
				this.memory.checkHeap(
					'memory_heap',
					this.appConfig.healthHeapLimitBytes,
				),
		]);
	}

	@Get('startup')
	@HealthCheck()
	@ApiDocsStartup()
	startup() {
		return this.health.check([() => this.db.pingCheck('database')]);
	}
}
