import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MfaService } from './mfa.service';
import { UserMfa } from '@auth/infrastructure/database/entities/user-mfa.entity';
import { User } from 'src/users/infrastructure/database/entities/user.entity';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import { PasswordEncryption } from 'src/infrastructure/encryption/password-encryption.provider';
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';

describe('MfaService', () => {
	let service: MfaService;
	let userMfaRepository: any;
	let passwordEncryption: any;
	let cacheManager: any;

	const mockUserMfaRepository = {
		findOne: jest.fn(),
		save: jest.fn(),
		create: jest.fn().mockImplementation((dto) => dto),
	};

	const mockUserRepository = {
		findOne: jest.fn(),
	};

	const mockAppConfig = {
		security: {
			mfaEncryptionSecret: 'test-secret-at-least-32-chars-long-!!!',
			mfaIssuerName: 'Gatuno',
		},
	};

	const mockPasswordEncryption = {
		encrypt: jest.fn(),
		compare: jest.fn(),
	};

	const mockCacheManager = {
		get: jest.fn(),
		set: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MfaService,
				{
					provide: getRepositoryToken(UserMfa),
					useValue: mockUserMfaRepository,
				},
				{
					provide: getRepositoryToken(User),
					useValue: mockUserRepository,
				},
				{
					provide: AppConfigService,
					useValue: mockAppConfig,
				},
				{
					provide: PasswordEncryption,
					useValue: mockPasswordEncryption,
				},
				{
					provide: CACHE_MANAGER,
					useValue: mockCacheManager,
				},
			],
		}).compile();

		service = module.get<MfaService>(MfaService);
		userMfaRepository = module.get(getRepositoryToken(UserMfa));
		passwordEncryption = module.get(PasswordEncryption);
		cacheManager = module.get(CACHE_MANAGER);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('consumeBackupCode', () => {
		it('should support SHA-256 backup codes (new format)', async () => {
			const plainCode = 'ABCDE-12345';
			const hashedCode = createHash('sha256')
				.update(plainCode)
				.digest('hex');
			const config = {
				backupCodesHash: [hashedCode],
				backupCodesUsed: 0,
			} as any;

			const result = await (service as any).consumeBackupCode(
				config,
				plainCode,
			);

			expect(result).toBe(true);
			expect(config.backupCodesHash).toHaveLength(0);
			expect(config.backupCodesUsed).toBe(1);
			expect(userMfaRepository.save).toHaveBeenCalled();
		});

		it('should support Bcrypt/Argon2 backup codes (legacy format)', async () => {
			const plainCode = 'LEGACY12';
			const hashedCode = '$2b$10$legacyhash...';
			const config = {
				backupCodesHash: [hashedCode],
				backupCodesUsed: 0,
			} as any;

			passwordEncryption.compare.mockResolvedValue(true);

			const result = await (service as any).consumeBackupCode(
				config,
				plainCode,
			);

			expect(result).toBe(true);
			expect(passwordEncryption.compare).toHaveBeenCalledWith(
				hashedCode,
				plainCode,
			);
			expect(config.backupCodesHash).toHaveLength(0);
		});

		it('should return false for invalid backup code', async () => {
			const config = {
				backupCodesHash: ['somehash'],
				backupCodesUsed: 0,
			} as any;

			const result = await (service as any).consumeBackupCode(
				config,
				'WRONG',
			);

			expect(result).toBe(false);
			expect(config.backupCodesHash).toHaveLength(1);
		});
	});

	describe('Replay Protection', () => {
		it('should throw UnauthorizedException if TOTP code is reused', async () => {
			const userId = 'user123';
			const code = '123456';
			cacheManager.get.mockResolvedValue(true);

			await expect(
				(service as any).checkAndLockTotp(userId, code),
			).rejects.toThrow(UnauthorizedException);
		});

		it('should lock TOTP code in cache if not already used', async () => {
			const userId = 'user123';
			const code = '123456';
			cacheManager.get.mockResolvedValue(null);

			await (service as any).checkAndLockTotp(userId, code);

			expect(cacheManager.set).toHaveBeenCalledWith(
				`totp_used:${userId}:${code}`,
				true,
				30000,
			);
		});
	});
});
