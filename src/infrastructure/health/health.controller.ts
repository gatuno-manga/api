import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { REDIS_CLIENT } from '../redis/redis.constants';
import { AppConfigService } from '../app-config/app-config.service';

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
	@ApiOperation({
		summary: 'Health check completo',
		description:
			'Verifica status do banco, Redis, Kafka, Meilisearch, RustFS, memória e disco',
	})
	@ApiResponse({
		status: 200,
		description: 'Aplicação saudável',
	})
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
	@ApiOperation({
		summary: 'Liveness probe',
		description: 'Verifica se a aplicação está rodando (para Kubernetes)',
	})
	@ApiResponse({
		status: 200,
		description: 'Aplicação está viva',
	})
	liveness() {
		return this.health.check([
			() => Promise.resolve({ liveness: { status: 'up' } }),
		]);
	}

	@Get('readiness')
	@HealthCheck()
	@ApiOperation({
		summary: 'Readiness probe',
		description:
			'Verifica se a aplicação está pronta para receber tráfego (para Kubernetes)',
	})
	@ApiResponse({
		status: 200,
		description: 'Aplicação está pronta',
	})
	@ApiResponse({
		status: 503,
		description: 'Aplicação não está pronta',
	})
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
	@ApiOperation({
		summary: 'Startup probe',
		description:
			'Verifica se a aplicação terminou de inicializar (para Kubernetes)',
	})
	@ApiResponse({
		status: 200,
		description: 'Aplicação inicializada',
	})
	startup() {
		return this.health.check([() => this.db.pingCheck('database')]);
	}
}
