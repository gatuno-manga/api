import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppConfigService } from './app-config.service';

describe('AppConfigService', () => {
	let service: AppConfigService;
	let configService: ConfigService;

	const mockConfigService = {
		get: jest.fn((key: string, defaultValue?: any) => {
			const config = {
				NODE_ENV: 'test',
				PORT: 3000,
				JWT_SECRET: 'test-secret',
				ACCESS_TOKEN_TTL: 3600,
				REFRESH_TOKEN_TTL: 86400,
				SALT_LENGTH: 16,
				PASSWORD_KEY_LENGTH: 64,
				DATABASE_HOST: 'localhost',
				DATABASE_PORT: 3306,
				DATABASE_USER: 'test',
				DATABASE_PASSWORD: 'test',
				DATABASE_NAME: 'test_db',
				REDIS_HOST: 'localhost',
				REDIS_PORT: 6379,
			};
			return config[key] || defaultValue;
		}),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AppConfigService,
				{
					provide: ConfigService,
					useValue: mockConfigService,
				},
			],
		}).compile();

		service = module.get<AppConfigService>(AppConfigService);
		configService = module.get<ConfigService>(ConfigService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('should have configService injected', () => {
		expect(configService).toBeDefined();
	});

	describe('environment getters', () => {
		it('should return NODE_ENV', () => {
			expect(service.nodeEnv).toBe('test');
		});

		it('should return PORT', () => {
			expect(service.port).toBe(3000);
		});
	});

	describe('JWT configuration', () => {
		it('should return jwt config object', () => {
			mockConfigService.get.mockImplementation((key) => {
				switch (key) {
					case 'JWT_ACCESS_SECRET':
						return 'test-secret';
					case 'JWT_ACCESS_EXPIRATION':
						return '15m';
					case 'JWT_REFRESH_SECRET':
						return 'test-refresh-secret';
					case 'JWT_REFRESH_EXPIRATION':
						return '60m';
					case 'JWT_ISSUER':
						return 'gatuno-auth';
					case 'JWT_AUDIENCE':
						return 'gatuno-api';
					default:
						return null;
				}
			});
			const jwt = service.jwt;
			expect(jwt.accessSecret).toBe('test-secret');
			expect(jwt.accessExpiration).toBe('15m');
			expect(jwt.refreshSecret).toBe('test-refresh-secret');
			expect(jwt.refreshExpiration).toBe('60m');
			expect(jwt.issuer).toBe('gatuno-auth');
			expect(jwt.audience).toBe('gatuno-api');
		});

		it('should calculate refreshTokenTtl in milliseconds', () => {
			mockConfigService.get.mockReturnValueOnce('60m');
			expect(service.refreshTokenTtl).toBe(60 * 60 * 1000);
		});
	});

	describe('Security configuration', () => {
		it('should return security config object', () => {
			mockConfigService.get.mockImplementation((key) => {
				switch (key) {
					case 'SALT_LENGTH':
						return 16;
					case 'PASSWORD_KEY_LENGTH':
						return 64;
					case 'MFA_ISSUER_NAME':
						return 'Gatuno';
					case 'MFA_ENCRYPTION_SECRET':
						return 'secret';
					case 'MFA_STEP_UP_ENABLED':
						return true;
					case 'MFA_CHALLENGE_EXPIRATION':
						return '5m';
					default:
						return null;
				}
			});
			const security = service.security;
			expect(security.saltLength).toBe(16);
			expect(security.passwordKeyLength).toBe(64);
			expect(security.mfaIssuerName).toBe('Gatuno');
			expect(security.mfaEncryptionSecret).toBe('secret');
			expect(security.mfaStepUpEnabled).toBe(true);
			expect(security.mfaChallengeExpiration).toBe('5m');
		});
	});

	describe('database configuration', () => {
		it('should return database config object', () => {
			const dbConfig = service.database;
			expect(dbConfig).toBeDefined();
			expect(dbConfig).toHaveProperty('type');
			expect(dbConfig).toHaveProperty('name');
			expect(dbConfig).toHaveProperty('host');
			expect(dbConfig).toHaveProperty('port');
			expect(dbConfig).toHaveProperty('username');
			expect(dbConfig).toHaveProperty('password');
		});
	});

	describe('redis configuration', () => {
		it('should return redis config object', () => {
			const redisConfig = service.redis;
			expect(redisConfig).toBeDefined();
			expect(redisConfig).toHaveProperty('host');
			expect(redisConfig).toHaveProperty('port');
			expect(redisConfig).toHaveProperty('password');
		});
	});

	describe('queue concurrency', () => {
		it('should return queueConcurrency config', () => {
			const queueConfig = service.queueConcurrency;
			expect(queueConfig).toBeDefined();
			expect(queueConfig).toHaveProperty('chapterScraping');
			expect(queueConfig).toHaveProperty('coverImage');
			expect(queueConfig).toHaveProperty('fixChapter');
		});
	});

	describe('other configurations', () => {
		it('should return playwright config', () => {
			const playwrightConfig = service.playwright;
			expect(playwrightConfig).toBeDefined();
			expect(playwrightConfig).toHaveProperty('debugMode');
			expect(playwrightConfig).toHaveProperty('slowMo');
			expect(playwrightConfig).toHaveProperty('wsEndpoint');
		});

		it('should return apiUrl', () => {
			mockConfigService.get.mockReturnValueOnce('http://api:3000');
			expect(service.apiUrl).toBe('http://api:3000');
		});

		it('should return appUrl', () => {
			mockConfigService.get.mockReturnValueOnce('http://app:4200');
			expect(service.appUrl).toBe('http://app:4200');
		});

		it('should return admin', () => {
			const admin = service.admin;
			expect(admin).toBeDefined();
			expect(admin).toHaveProperty('email');
			expect(admin).toHaveProperty('password');
		});
	});
});
