import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	DiskHealthIndicator,
	HealthCheck,
	HealthCheckService,
	MemoryHealthIndicator,
	TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { AppConfigService } from '../app-config/app-config.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
	constructor(
		private health: HealthCheckService,
		private db: TypeOrmHealthIndicator,
		private memory: MemoryHealthIndicator,
		private disk: DiskHealthIndicator,
		private appConfig: AppConfigService,
	) {}

	@Get()
	@HealthCheck()
	@ApiOperation({
		summary: 'Health check completo',
		description: 'Verifica status do banco, memória e disco',
	})
	@ApiResponse({
		status: 200,
		description: 'Aplicação saudável',
		schema: {
			example: {
				status: 'ok',
				info: {
					database: { status: 'up' },
					memory_heap: { status: 'up' },
					memory_rss: { status: 'up' },
					storage: { status: 'up' },
				},
			},
		},
	})
	@ApiResponse({
		status: 503,
		description: 'Aplicação com problemas',
	})
	check() {
		return this.health.check([
			() => this.db.pingCheck('database'),
			() =>
				this.memory.checkHeap(
					'memory_heap',
					this.appConfig.healthHeapLimitBytes,
				),
			() =>
				this.memory.checkRSS(
					'memory_rss',
					this.appConfig.healthRssLimitBytes,
				),
			() =>
				this.disk.checkStorage('storage', {
					path: '/',
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
			() => this.memory.checkHeap('memory_heap', 400 * 1024 * 1024),
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
