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
