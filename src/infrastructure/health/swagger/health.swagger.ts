import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export function ApiDocsCheck() {
	return applyDecorators(
		ApiOperation({
			summary: 'Health check completo',
			description:
				'Verifica status do banco, Redis, Kafka, Meilisearch, RustFS, memória e disco',
		}),
		ApiResponse({
			status: 200,
			description: 'Aplicação saudável',
		}),
	);
}

export function ApiDocsLiveness() {
	return applyDecorators(
		ApiOperation({
			summary: 'Liveness probe',
			description:
				'Verifica se a aplicação está rodando (para Kubernetes)',
		}),
		ApiResponse({
			status: 200,
			description: 'Aplicação está viva',
		}),
	);
}

export function ApiDocsReadiness() {
	return applyDecorators(
		ApiOperation({
			summary: 'Readiness probe',
			description:
				'Verifica se a aplicação está pronta para receber tráfego (para Kubernetes)',
		}),
		ApiResponse({
			status: 200,
			description: 'Aplicação está pronta',
		}),
		ApiResponse({
			status: 503,
			description: 'Aplicação não está pronta',
		}),
	);
}

export function ApiDocsStartup() {
	return applyDecorators(
		ApiOperation({
			summary: 'Startup probe',
			description:
				'Verifica se a aplicação terminou de inicializar (para Kubernetes)',
		}),
		ApiResponse({
			status: 200,
			description: 'Aplicação inicializada',
		}),
	);
}
