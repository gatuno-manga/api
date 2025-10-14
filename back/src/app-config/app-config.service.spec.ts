import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from './app-config.service';
import { ConfigService } from '@nestjs/config';

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
        it('should return jwtAccessSecret', () => {
            mockConfigService.get.mockReturnValueOnce('test-secret');
            expect(service.jwtAccessSecret).toBe('test-secret');
        });

        it('should return jwtAccessExpiration', () => {
            mockConfigService.get.mockReturnValueOnce('15m');
            expect(service.jwtAccessExpiration).toBe('15m');
        });

        it('should return jwtRefreshSecret', () => {
            mockConfigService.get.mockReturnValueOnce('test-refresh-secret');
            expect(service.jwtRefreshSecret).toBe('test-refresh-secret');
        });

        it('should return jwtRefreshExpiration', () => {
            mockConfigService.get.mockReturnValueOnce('60m');
            expect(service.jwtRefreshExpiration).toBe('60m');
        });

        it('should calculate refreshTokenTtl in milliseconds', () => {
            mockConfigService.get.mockReturnValueOnce('60m');
            expect(service.refreshTokenTtl).toBe(60 * 60 * 1000);
        });
    });

    describe('password configuration', () => {
        it('should return saltLength', () => {
            mockConfigService.get.mockReturnValueOnce(16);
            expect(service.saltLength).toBe(16);
        });

        it('should return passwordKeyLength', () => {
            mockConfigService.get.mockReturnValueOnce(64);
            expect(service.passwordKeyLength).toBe(64);
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
        it('should return seleniumUrl', () => {
            mockConfigService.get.mockReturnValueOnce('http://selenium:4444/wd/hub');
            expect(service.seleniumUrl).toBe('http://selenium:4444/wd/hub');
        });

        it('should return apiUrl', () => {
            mockConfigService.get.mockReturnValueOnce('http://api:3000');
            expect(service.apiUrl).toBe('http://api:3000');
        });

        it('should return appUrl', () => {
            mockConfigService.get.mockReturnValueOnce('http://app:4200');
            expect(service.appUrl).toBe('http://app:4200');
        });

        it('should return adminInfo', () => {
            const adminInfo = service.adminInfo;
            expect(adminInfo).toBeDefined();
            expect(adminInfo).toHaveProperty('email');
            expect(adminInfo).toHaveProperty('password');
        });
    });
});
