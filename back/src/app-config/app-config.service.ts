import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ms from 'ms';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AppConfigService {
	private readonly logger = new Logger(AppConfigService.name);
	constructor(private readonly config: ConfigService) {}

	get nodeEnv(): string {
		return this.config.get<string>('NODE_ENV') || 'development';
	}

	get port(): number {
		return this.config.get<number>('PORT') || 3000;
	}

	get apiUrl(): string {
		return this.config.get<string>('API_URL') || 'http://localhost:3000';
	}

	get appUrl(): string {
		return this.config.get<string>('APP_URL') || 'http://localhost:4200';
	}

	get jwtAccessSecret(): string {
		return this.config.get<string>('JWT_ACCESS_SECRET') || 'default_secret';
	}

	get jwtAccessExpiration(): string {
		return this.config.get<string>('JWT_ACCESS_EXPIRATION') || '15m';
	}

	get jwtRefreshSecret(): string {
		return (
			this.config.get<string>('JWT_REFRESH_SECRET') ||
			'default_refresh_secret'
		);
	}

	get jwtRefreshExpiration(): string {
		return this.config.get<string>('JWT_REFRESH_EXPIRATION') || '7d';
	}

	get saltLength(): number {
		return this.config.get<number>('SALT_LENGTH') || 16;
	}

	get passwordKeyLength(): number {
		return this.config.get<number>('PASSWORD_KEY_LENGTH') || 64;
	}

	get adminInfo() {
		return {
			email: this.config.get<string>('USERADMIN_EMAIL') || '',
			password: this.config.get<string>('USERADMIN_PASSWORD') || '',
		};
	}

	get database() {
		return {
			type: this.config.get<string>('DB_TYPE'),
			name: this.config.get<string>('DB_NAME'),
			host: this.config.get<string>('DB_MASTER_HOST'),
			port: this.config.get<number>('DB_PORT'),
			username: this.config.get<string>('DB_USER'),
			password: this.config.get<string>('DB_PASS'),
			slaveHosts: (this.config.get<string>('DB_SLAVE_HOSTS') || '')
				.split(',')
				.map((h) => h.trim())
				.filter(Boolean),
		};
	}

	get redis() {
		return {
			host: this.config.get<string>('REDIS_HOST'),
			port: this.config.get<number>('REDIS_PORT') || 6379,
			password: this.config.get<string>('REDIS_PASSWORD') || '',
		};
	}

	get queueConcurrency() {
		return {
			chapterScraping:
				this.config.get<number>('CHAPTER_SCRAPING_CONCURRENCY') || 6,
			coverImage: this.config.get<number>('COVER_IMAGE_CONCURRENCY') || 3,
			fixChapter: this.config.get<number>('FIX_CHAPTER_CONCURRENCY') || 2,
			bookUpdate: this.config.get<number>('BOOK_UPDATE_CONCURRENCY') || 2,
		};
	}

	get LogLevel(): string {
		return this.config.get<string>('LOG_LEVEL') || 'context=*;level=info';
	}

	get metricsEnabled(): boolean {
		return this.config.get<boolean>('METRICS_ENABLED') ?? true;
	}

	get metricsPath(): string {
		return this.config.get<string>('METRICS_PATH') || '/api/metrics';
	}

	get metricsPrefix(): string {
		return this.config.get<string>('METRICS_PREFIX') || 'gatuno_';
	}

	get grafanaPort(): number {
		return this.config.get<number>('GRAFANA_PORT') || 3002;
	}

	get prometheusScrapeInterval(): string {
		return this.config.get<string>('PROMETHEUS_SCRAPE_INTERVAL') || '10s';
	}

	get healthHeapLimitBytes(): number {
		const mb = this.config.get<number>('HEALTH_HEAP_LIMIT_MB') || 300;
		return mb * 1024 * 1024;
	}

	get healthRssLimitBytes(): number {
		const mb = this.config.get<number>('HEALTH_RSS_LIMIT_MB') || 500;
		return mb * 1024 * 1024;
	}

	get healthReadinessHeapLimitBytes(): number {
		const mb =
			this.config.get<number>('HEALTH_READINESS_HEAP_LIMIT_MB') || 400;
		return mb * 1024 * 1024;
	}

	get healthDiskThresholdPercent(): number {
		return this.config.get<number>('HEALTH_DISK_THRESHOLD_PERCENT') ?? 0.7;
	}

	private parseDurationToMilliseconds(duration: string): number {
		try {
			const result = ms(duration as ms.StringValue);
			if (result === undefined || result <= 0) {
				this.logger.warn(
					`Invalid duration format "${duration}". Falling back to 7 days.`,
				);
				return SEVEN_DAYS_MS;
			}
			return result;
		} catch {
			this.logger.warn(
				`Failed to parse duration "${duration}". Falling back to 7 days.`,
			);
			return SEVEN_DAYS_MS;
		}
	}

	get refreshTokenTtl(): number {
		const duration = this.jwtRefreshExpiration;
		return this.parseDurationToMilliseconds(duration);
	}

	/** 0 = unlimited sessions */
	get maxSessionsPerUser(): number {
		return this.config.get<number>('MAX_SESSIONS_PER_USER') ?? 0;
	}

	get playwright() {
		return {
			debugMode: this.config.get<boolean>('PLAYWRIGHT_DEBUG') ?? false,
			slowMo: this.config.get<number>('PLAYWRIGHT_SLOW_MO') ?? 0,
			wsEndpoint: this.config.get<string>('PLAYWRIGHT_WS_ENDPOINT') ?? '',
		};
	}

	get browserPool() {
		return {
			enabled: this.config.get<boolean>('BROWSER_POOL_ENABLED') ?? true,
			poolSize: this.config.get<number>('BROWSER_POOL_SIZE') ?? 2,
			maxContextsPerBrowser:
				this.config.get<number>(
					'BROWSER_POOL_MAX_CONTEXTS_PER_BROWSER',
				) ?? 4,
			acquireTimeout:
				this.config.get<number>('BROWSER_POOL_ACQUIRE_TIMEOUT') ??
				30000,
			idleTimeout:
				this.config.get<number>('BROWSER_POOL_IDLE_TIMEOUT') ?? 300000,
			maxContextsBeforeRestart:
				this.config.get<number>(
					'BROWSER_POOL_MAX_CONTEXTS_BEFORE_RESTART',
				) ?? 50,
		};
	}

	get networkCache() {
		return {
			maxSizeMB:
				this.config.get<number>('NETWORK_CACHE_MAX_SIZE_MB') ?? 100,
			largeImageThresholdMB:
				this.config.get<number>(
					'NETWORK_CACHE_LARGE_IMAGE_THRESHOLD_MB',
				) ?? 5,
		};
	}

	get bookUpdate() {
		return {
			enabled: this.config.get<boolean>('BOOK_UPDATE_ENABLED') ?? true,
			cronExpression:
				this.config.get<string>('BOOK_UPDATE_CRON') || '0 */6 * * *', // Every 6 hours
		};
	}

	get downloadCacheThresholdMB(): number {
		return this.config.get<number>('DOWNLOAD_CACHE_THRESHOLD_MB') || 100;
	}
}
