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
	JWT_ACCESS_EXPIRATION: Joi.string()
		.pattern(/^\d+\s*(s|m|h|d|w|y)$/)
		.default('15m')
		.description('Access token expiration (e.g. 15m, 1h, 7d)'),
	JWT_REFRESH_SECRET: Joi.string().default('default_refresh_secret'),
	JWT_REFRESH_EXPIRATION: Joi.string()
		.pattern(/^\d+\s*(s|m|h|d|w|y)$/)
		.default('7d')
		.description('Refresh token expiration (e.g. 60m, 7d, 30d)'),
	MAX_SESSIONS_PER_USER: Joi.number()
		.min(0)
		.default(0)
		.description('Max simultaneous sessions per user. 0 = unlimited'),
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
	BOOK_UPDATE_CONCURRENCY: Joi.number()
		.min(1)
		.default(2)
		.description('Concurrency for book update queue'),
	// Book Auto-Update Settings
	BOOK_UPDATE_ENABLED: Joi.boolean()
		.default(true)
		.description('Enable automatic book update checks'),
	BOOK_UPDATE_CRON: Joi.string()
		.default('0 */6 * * *')
		.description(
			'Cron expression for book update schedule (default: every 6 hours)',
		),
	// Monitoring / Metrics
	METRICS_ENABLED: Joi.boolean()
		.default(true)
		.description('Enable Prometheus metrics endpoint'),
	METRICS_PATH: Joi.string()
		.default('/api/metrics')
		.description('Path where metrics are exposed'),
	METRICS_PREFIX: Joi.string()
		.default('gatuno_')
		.description('Prefix applied to metrics'),
	GRAFANA_PORT: Joi.number()
		.min(0)
		.max(65535)
		.default(3002)
		.description('Local Grafana port used for developer convenience'),
	PROMETHEUS_SCRAPE_INTERVAL: Joi.string()
		.default('10s')
		.description('Default scrape interval used by Prometheus rules/docs'),
	HEALTH_HEAP_LIMIT_MB: Joi.number()
		.min(1)
		.default(300)
		.description('Heap limit in MB for health check'),
	HEALTH_RSS_LIMIT_MB: Joi.number()
		.min(1)
		.default(500)
		.description('RSS limit in MB for health check'),
	HEALTH_READINESS_HEAP_LIMIT_MB: Joi.number()
		.min(1)
		.default(400)
		.description('Heap limit in MB for readiness check'),
	HEALTH_DISK_THRESHOLD_PERCENT: Joi.number()
		.min(0)
		.max(1)
		.default(0.7)
		.description(
			'Disk usage threshold (fraction) for storage health check',
		),
	// Playwright / Scraping Debug
	PLAYWRIGHT_DEBUG: Joi.boolean()
		.default(false)
		.description('Enable Playwright debug mode with visible browser'),
	PLAYWRIGHT_SLOW_MO: Joi.number()
		.min(0)
		.default(0)
		.description('Slow down Playwright operations by specified ms'),
	PLAYWRIGHT_WS_ENDPOINT: Joi.string()
		.optional()
		.allow('')
		.description('WebSocket endpoint for remote browser connection'),
	// Browser Pool Settings
	BROWSER_POOL_ENABLED: Joi.boolean()
		.default(true)
		.description('Enable browser pooling'),
	BROWSER_POOL_SIZE: Joi.number()
		.min(1)
		.max(10)
		.default(2)
		.description('Number of browsers to maintain in the pool'),
	BROWSER_POOL_MAX_CONTEXTS_PER_BROWSER: Joi.number()
		.min(1)
		.max(20)
		.default(4)
		.description('Maximum number of contexts per browser'),
	BROWSER_POOL_ACQUIRE_TIMEOUT: Joi.number()
		.min(1000)
		.default(30000)
		.description('Timeout in ms to wait for a browser to become available'),
	BROWSER_POOL_IDLE_TIMEOUT: Joi.number()
		.min(60000)
		.default(300000)
		.description('Idle timeout in ms before browser can be restarted'),
	BROWSER_POOL_MAX_CONTEXTS_BEFORE_RESTART: Joi.number()
		.min(10)
		.default(50)
		.description('Restart browser after this many contexts created'),
	// Network Interceptor Memory Settings
	NETWORK_CACHE_MAX_SIZE_MB: Joi.number()
		.min(10)
		.default(100)
		.description('Maximum size of network cache in MB'),
	NETWORK_CACHE_LARGE_IMAGE_THRESHOLD_MB: Joi.number()
		.min(1)
		.default(5)
		.description(
			'Stream images to disk if larger than this threshold in MB',
		),
	// Download Cache Settings
	DOWNLOAD_CACHE_THRESHOLD_MB: Joi.number()
		.min(1)
		.default(100)
		.description(
			'Size threshold in MB for switching from buffer to streaming mode in downloads',
		),
});
