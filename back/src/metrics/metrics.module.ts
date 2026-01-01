import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import {
	makeCounterProvider,
	makeHistogramProvider,
	makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';

const httpRequestsTotal = makeCounterProvider({
	name: 'http_requests_total',
	help: 'Total de requisições HTTP',
	labelNames: ['method', 'route', 'status'],
});

const httpRequestDuration = makeHistogramProvider({
	name: 'http_request_duration_seconds',
	help: 'Duração das requisições HTTP em segundos',
	labelNames: ['method', 'route', 'status'],
	buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

const httpRequestSize = makeHistogramProvider({
	name: 'http_request_size_bytes',
	help: 'Tamanho das requisições HTTP em bytes',
	labelNames: ['method', 'route'],
	buckets: [100, 1000, 10000, 100000, 1000000],
});

const httpResponseSize = makeHistogramProvider({
	name: 'http_response_size_bytes',
	help: 'Tamanho das respostas HTTP em bytes',
	labelNames: ['method', 'route', 'status'],
	buckets: [100, 1000, 10000, 100000, 1000000],
});

const booksTotal = makeGaugeProvider({
	name: 'books_total',
	help: 'Total de livros no sistema',
});

const booksScrapingTotal = makeCounterProvider({
	name: 'books_scraping_total',
	help: 'Total de livros processados por scraping',
	labelNames: ['status'],
});

const booksScrapingDuration = makeHistogramProvider({
	name: 'books_scraping_duration_seconds',
	help: 'Duração do scraping de livros',
	labelNames: ['status'],
	buckets: [1, 5, 10, 30, 60, 120, 300, 600],
});

const chaptersTotal = makeGaugeProvider({
	name: 'chapters_total',
	help: 'Total de capítulos no sistema',
});

const chaptersProcessedTotal = makeCounterProvider({
	name: 'chapters_processed_total',
	help: 'Total de capítulos processados',
	labelNames: ['status'],
});

const chapterProcessingDuration = makeHistogramProvider({
	name: 'chapter_processing_duration_seconds',
	help: 'Duração do processamento de capítulos',
	labelNames: ['operation'],
	buckets: [1, 5, 10, 30, 60, 120, 300],
});

const fileUploadsTotal = makeCounterProvider({
	name: 'file_uploads_total',
	help: 'Total de uploads de arquivos',
	labelNames: ['type', 'status'],
});

const fileUploadSize = makeHistogramProvider({
	name: 'file_upload_size_bytes',
	help: 'Tamanho dos arquivos enviados',
	labelNames: ['type'],
	buckets: [10000, 100000, 500000, 1000000, 5000000, 10000000],
});

const fileUploadDuration = makeHistogramProvider({
	name: 'file_upload_duration_seconds',
	help: 'Duração dos uploads de arquivos',
	labelNames: ['type'],
	buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const queueJobsActive = makeGaugeProvider({
	name: 'queue_jobs_active',
	help: 'Número de jobs ativos na fila',
	labelNames: ['queue'],
});

const queueJobsCompletedTotal = makeCounterProvider({
	name: 'queue_jobs_completed_total',
	help: 'Total de jobs completados',
	labelNames: ['queue', 'status'],
});

const queueJobDuration = makeHistogramProvider({
	name: 'queue_job_duration_seconds',
	help: 'Duração dos jobs na fila',
	labelNames: ['queue'],
	buckets: [1, 5, 10, 30, 60, 120, 300, 600],
});

const databaseQueriesTotal = makeCounterProvider({
	name: 'database_queries_total',
	help: 'Total de queries executadas',
	labelNames: ['operation'],
});

const databaseQueryDuration = makeHistogramProvider({
	name: 'database_query_duration_seconds',
	help: 'Duração das queries de banco de dados',
	labelNames: ['operation'],
	buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

const databaseErrorsTotal = makeCounterProvider({
	name: 'database_errors_total',
	help: 'Total de erros de banco de dados',
	labelNames: ['error_type'],
});

const usersTotal = makeGaugeProvider({
	name: 'users_total',
	help: 'Total de usuários no sistema',
});

const usersActive = makeGaugeProvider({
	name: 'users_active',
	help: 'Usuários ativos (logaram nas últimas 24h)',
});

const authAttemptsTotal = makeCounterProvider({
	name: 'auth_attempts_total',
	help: 'Total de tentativas de autenticação',
	labelNames: ['status'],
});

const errorsTotal = makeCounterProvider({
	name: 'errors_total',
	help: 'Total de erros na aplicação',
	labelNames: ['type', 'severity'],
});

const cacheHitsTotal = makeCounterProvider({
	name: 'cache_hits_total',
	help: 'Total de cache hits',
	labelNames: ['cache_name'],
});

const cacheMissesTotal = makeCounterProvider({
	name: 'cache_misses_total',
	help: 'Total de cache misses',
	labelNames: ['cache_name'],
});

const metricsProviders = [
	httpRequestsTotal,
	httpRequestDuration,
	httpRequestSize,
	httpResponseSize,
	booksTotal,
	booksScrapingTotal,
	booksScrapingDuration,
	chaptersTotal,
	chaptersProcessedTotal,
	chapterProcessingDuration,
	fileUploadsTotal,
	fileUploadSize,
	fileUploadDuration,
	queueJobsActive,
	queueJobsCompletedTotal,
	queueJobDuration,
	databaseQueriesTotal,
	databaseQueryDuration,
	databaseErrorsTotal,
	usersTotal,
	usersActive,
	authAttemptsTotal,
	errorsTotal,
	cacheHitsTotal,
	cacheMissesTotal,
];

@Module({
	imports: [
		PrometheusModule.register({
			path: '/metrics',
			defaultMetrics: {
				enabled: true,
				config: {
					prefix: 'gatuno_',
				},
			},
		}),
	],
	providers: metricsProviders,
	exports: [PrometheusModule, ...metricsProviders],
})
export class MetricsModule {}
