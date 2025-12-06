import * as Joi from 'joi';

export const validationSchema = Joi.object({
	NODE_ENV: Joi.string()
		.valid('development', 'production', 'test')
		.default('development')
		.description('The Node.js environment'),
	PORT: Joi.number()
		.min(0)
		.max(65535)
		.default(3000)
		.description('The port on which the application will run'),
	DB_TYPE: Joi.string().required(),
	DB_NAME: Joi.string().required(),
	DB_MASTER_HOST: Joi.string().required(),
	DB_SLAVE_HOSTS: Joi.string().required(),
	DB_PORT: Joi.number().min(0).max(65535).required(),
	DB_USER: Joi.string().required(),
	DB_PASS: Joi.string().required(),
	API_URL: Joi.string().required(),
	APP_URL: Joi.string().required(),
	ALLOWED_URL: Joi.string().required(),
	JWT_ACCESS_SECRET: Joi.string().default('default_secret'),
	JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
	JWT_REFRESH_SECRET: Joi.string().default('default_refresh_secret'),
	JWT_REFRESH_EXPIRATION: Joi.string().default('60m'),
	SALT_LENGTH: Joi.number().min(1).default(16),
	PASSWORD_KEY_LENGTH: Joi.number().min(1).default(64),
	REDIS_HOST: Joi.string().required(),
	REDIS_PORT: Joi.number().min(0).max(65535).default(6379),
	REDIS_PASSWORD: Joi.string().optional().allow(''),
	USERADMIN_EMAIL: Joi.string().email().required(),
	USERADMIN_PASSWORD: Joi.string().required(),
	// Queue Concurrency Settings
	CHAPTER_SCRAPING_CONCURRENCY: Joi.number().min(1).default(6),
	COVER_IMAGE_CONCURRENCY: Joi.number().min(1).default(3),
	FIX_CHAPTER_CONCURRENCY: Joi.number().min(1).default(2),
	// Monitoring / Metrics
	METRICS_ENABLED: Joi.boolean().default(true)
		.description('Enable Prometheus metrics endpoint'),
	METRICS_PATH: Joi.string().default('/api/metrics').description('Path where metrics are exposed'),
	METRICS_PREFIX: Joi.string().default('gatuno_').description('Prefix applied to metrics'),
	GRAFANA_PORT: Joi.number().min(0).max(65535).default(3002).description('Local Grafana port used for developer convenience'),
	PROMETHEUS_SCRAPE_INTERVAL: Joi.string().default('10s').description('Default scrape interval used by Prometheus rules/docs'),
	HEALTH_HEAP_LIMIT_MB: Joi.number().min(1).default(300).description('Heap limit in MB for health check'),
	HEALTH_RSS_LIMIT_MB: Joi.number().min(1).default(500).description('RSS limit in MB for health check'),
	HEALTH_READINESS_HEAP_LIMIT_MB: Joi.number().min(1).default(400).description('Heap limit in MB for readiness check'),
	HEALTH_DISK_THRESHOLD_PERCENT: Joi.number().min(0).max(1).default(0.7).description('Disk usage threshold (fraction) for storage health check'),
	// Playwright / Scraping Debug
	PLAYWRIGHT_DEBUG: Joi.boolean().default(false).description('Enable Playwright debug mode with visible browser'),
	PLAYWRIGHT_SLOW_MO: Joi.number().min(0).default(0).description('Slow down Playwright operations by specified ms'),
	PLAYWRIGHT_WS_ENDPOINT: Joi.string().optional().allow('').description('WebSocket endpoint for remote browser connection'),
});
