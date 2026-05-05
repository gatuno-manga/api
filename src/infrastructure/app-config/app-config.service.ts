import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ms from 'ms';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

import {
	AdminConfig,
	DatabaseConfig,
	JwtConfig,
	MeiliConfig,
	RedisConfig,
	SecurityConfig,
} from './app-config.values';

@Injectable()
export class AppConfigService {
	private readonly logger = new Logger(AppConfigService.name);
	constructor(private readonly config: ConfigService) {}

	private parseCsv(value?: string): string[] {
		return (value || '')
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);
	}

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

	get allowedUrls(): string[] {
		const configured = this.parseCsv(
			this.config.get<string>('ALLOWED_URL'),
		);
		if (configured.length > 0) {
			return configured;
		}

		return [this.appUrl];
	}

	get jwt(): JwtConfig {
		return new JwtConfig(
			this.config.get<string>('JWT_ACCESS_SECRET') || 'default_secret',
			this.config.get<string>('JWT_ACCESS_EXPIRATION') || '15m',
			this.config.get<string>('JWT_REFRESH_SECRET') ||
				'default_refresh_secret',
			this.config.get<string>('JWT_REFRESH_EXPIRATION') || '7d',
			this.config.get<string>('JWT_ISSUER') || 'gatuno-auth',
			this.config.get<string>('JWT_AUDIENCE') || 'gatuno-api',
		);
	}

	get security(): SecurityConfig {
		return new SecurityConfig(
			this.config.get<number>('SALT_LENGTH') || 16,
			this.config.get<number>('PASSWORD_KEY_LENGTH') || 64,
			this.config.get<string>('MFA_ISSUER_NAME') || 'Gatuno',
			this.config.get<string>('MFA_ENCRYPTION_SECRET') ||
				this.jwt.refreshSecret,
			this.config.get<boolean>('MFA_STEP_UP_ENABLED') ?? true,
			this.config.get<string>('MFA_CHALLENGE_EXPIRATION') || '5m',
			this.config.get<string>('AUTH_API_KEY_DEFAULT_EXPIRATION') || '1h',
			this.config.get<string>('AUTH_API_KEY_MAX_EXPIRATION') || '30d',
		);
	}

	get admin(): AdminConfig {
		return new AdminConfig(
			this.config.get<string>('USERADMIN_EMAIL') || '',
			this.config.get<string>('USERADMIN_PASSWORD') || '',
		);
	}

	private resolveHostFromUrl(url: string): string {
		try {
			return new URL(url).hostname;
		} catch {
			return 'localhost';
		}
	}

	get webauthnRpName(): string {
		return this.config.get<string>('WEBAUTHN_RP_NAME') || 'Gatuno';
	}

	get webauthnRpId(): string {
		const configured = this.config.get<string>('WEBAUTHN_RP_ID');
		if (configured && configured.trim().length > 0) {
			return configured.trim();
		}

		return this.resolveHostFromUrl(this.appUrl);
	}

	get webauthnAllowedOrigins(): string[] {
		const configured = this.parseCsv(
			this.config.get<string>('WEBAUTHN_ALLOWED_ORIGINS'),
		);
		if (configured.length > 0) {
			return configured;
		}

		return this.allowedUrls;
	}

	get webauthnChallengeTtlMs(): number {
		return this.config.get<number>('WEBAUTHN_CHALLENGE_TTL_MS') ?? 300000;
	}

	get database(): DatabaseConfig {
		return new DatabaseConfig(
			this.config.get<string>('DB_TYPE') ?? 'mysql',
			this.config.get<string>('DB_NAME') ?? '',
			this.config.get<string>('DB_MASTER_HOST') ?? '',
			this.config.get<number>('DB_PORT') ?? 3306,
			this.config.get<string>('DB_USER') ?? '',
			this.config.get<string>('DB_PASS') ?? '',
			this.parseCsv(this.config.get<string>('DB_SLAVE_HOSTS')),
		);
	}

	get redis(): RedisConfig {
		return new RedisConfig(
			this.config.get<string>('REDIS_HOST') ?? '',
			this.config.get<number>('REDIS_PORT') || 6379,
			this.config.get<string>('REDIS_PASSWORD') || '',
		);
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

	get logRedactPaths(): string[] {
		return this.parseCsv(
			this.config.get<string>('LOG_REDACT_PATHS') ||
				'req.headers.authorization,req.headers.cookie,req.body.password,req.body.apiKey,req.body.token,res.headers["set-cookie"]',
		);
	}

	get logSamplingRate(): number {
		return this.config.get<number>('LOG_SAMPLING_RATE') ?? 1.0;
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
		const duration = this.jwt.refreshExpiration;
		return this.parseDurationToMilliseconds(duration);
	}

	get authApiKeyDefaultTtl(): number {
		return this.parseDurationToMilliseconds(
			this.config.get<string>('AUTH_API_KEY_DEFAULT_EXPIRATION') || '1h',
		);
	}

	get authApiKeyMaxTtl(): number {
		return this.parseDurationToMilliseconds(
			this.config.get<string>('AUTH_API_KEY_MAX_EXPIRATION') || '30d',
		);
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

	get kafkaBroker(): string {
		const host = this.config.get<string>('KAFKA_HOST') || 'kafka';
		const port = this.config.get<number>('KAFKA_PORT') || 9092;
		return `${host}:${port}`;
	}

	get rustfs() {
		return {
			endpoint: this.config.get<string>(
				'RUSTFS_ENDPOINT',
				'http://rustfs:9000',
			),
			bucket: this.config.get<string>('RUSTFS_BUCKET', 'gatuno-files'),
			publicUrl: this.config.get<string>('RUSTFS_PUBLIC_URL', ''),
		};
	}

	get rustfsPublicUrl(): string {
		return (
			this.config.get<string>('RUSTFS_PUBLIC_URL') ||
			`${this.apiUrl}/api/data`
		);
	}

	get flareSolverrUrl(): string {
		return (
			this.config.get<string>('FLARESOLVERR_URL') ||
			'http://flaresolverr:8191'
		);
	}

	get meili(): MeiliConfig {
		return new MeiliConfig(
			this.config.get<string>('MEILI_HOST') || 'http://meilisearch:7700',
			this.config.get<string>('MEILI_MASTER_KEY') || '',
		);
	}

	get nanomq() {
		return {
			host: this.config.get<string>('NANOMQ_HOST') || 'nanomq',
			port: this.config.get<number>('NANOMQ_PORT') || 1883,
		};
	}

	get android() {
		return {
			packageName:
				this.config.get<string>('ANDROID_PACKAGE_NAME') ||
				'com.gatuno.app',
			sha256Fingerprints: this.parseCsv(
				this.config.get<string>('ANDROID_SHA256_FINGERPRINTS'),
			),
		};
	}

	get enableSwagger(): boolean {
		return this.config.get<boolean>('ENABLE_SWAGGER') ?? false;
	}
}
