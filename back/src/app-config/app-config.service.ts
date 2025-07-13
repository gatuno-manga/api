import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

	get JwtAccessSecret(): string {
		return this.config.get<string>('JWT_ACCESS_SECRET') || 'default_secret';
	}

	get jwtAccessExpiration(): string {
		return this.config.get<string>('JWT_ACCESS_EXPIRATION') || '15m';
	}

	get JwtRefreshSecret(): string {
		return this.config.get<string>('JWT_REFRESH_SECRET') || 'default_refresh_secret';
	}

	get JwtRefreshExpiration(): string {
		return this.config.get<string>('JWT_REFRESH_EXPIRATION') || '60m';
	}

	get SaltLength(): number {
		return this.config.get<number>('SALT_LENGTH') || 16;
	}

	get PasswordKeyLength(): number {
		return this.config.get<number>('PASSWORD_KEY_LENGTH') || 64;
	}

	get database() {
		return {
			type: this.config.get<string>('DB_TYPE'),
			name: this.config.get<string>('DB_NAME'),
			host: this.config.get<string>('DB_HOST'),
			port: this.config.get<number>('DB_PORT'),
			username: this.config.get<string>('DB_USER'),
			password: this.config.get<string>('DB_PASS'),
		};
	}
}
