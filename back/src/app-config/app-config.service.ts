import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SEVEN_DAYS_IN_SECONDS = 604800; // Default: 7 dias
@Injectable()
export class AppConfigService {
	constructor(private readonly config: ConfigService) {}

	get nodeEnv(): string {
		return this.config.get<string>('NODE_ENV') || 'development';
	}

	get port(): number {
		return this.config.get<number>('PORT') || 3000;
	}

	get seleniumUrl(): string {
		return (
			this.config.get<string>('SELENIUM_URL') ||
			'http://localhost:4444/wd/hub'
		);
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
		return this.config.get<string>('JWT_REFRESH_SECRET') || 'default_refresh_secret';
	}

	get jwtRefreshExpiration(): string {
		return this.config.get<string>('JWT_REFRESH_EXPIRATION') || '60m';
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
		}
	}

	get database() {
		return {
			type: this.config.get<string>('DB_TYPE'),
			name: this.config.get<string>('DB_NAME'),
			host: this.config.get<string>('DB_MASTER_HOST'),
			port: this.config.get<number>('DB_PORT'),
			username: this.config.get<string>('DB_USER'),
			password: this.config.get<string>('DB_PASS'),
			slaveHosts: (this.config.get<string>('DB_SLAVE_HOSTS') || '').split(','),
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
			chapterScraping: this.config.get<number>('CHAPTER_SCRAPING_CONCURRENCY') || 6,
			coverImage: this.config.get<number>('COVER_IMAGE_CONCURRENCY') || 3,
			fixChapter: this.config.get<number>('FIX_CHAPTER_CONCURRENCY') || 2,
		};
	}

	private parseDurationToSeconds(duration: string): number {
		const match = duration.match(/^(\d+)([smhd])$/);
		if (!match) {
			return SEVEN_DAYS_IN_SECONDS;
		}

		const value = parseInt(match[1], 10);
		const unit = match[2];

		switch (unit) {
			case 's': return value;
			case 'm': return value * 60;
			case 'h': return value * 60 * 60;
			case 'd': return value * 24 * 60 * 60;
			default: return SEVEN_DAYS_IN_SECONDS;
		}
	}

	get refreshTokenTtl(): number {
		const duration = this.jwtRefreshExpiration;
		return this.parseDurationToSeconds(duration);
	}
}
