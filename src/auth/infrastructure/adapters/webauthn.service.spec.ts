import { WebAuthnCredential } from '@auth/infrastructure/database/entities/webauthn-credential.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
	generateAuthenticationOptions,
	verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import { User } from 'src/users/infrastructure/database/entities/user.entity';
import { WebauthnService } from './webauthn.service';

jest.mock('@simplewebauthn/server');

describe('WebauthnService', () => {
	let service: WebauthnService;
	let userRepository: any;
	let credentialRepository: any;
	let cacheManager: any;

	const mockUserRepository = {
		findOne: jest.fn(),
	};

	const mockCredentialRepository = {
		find: jest.fn(),
		findOne: jest.fn(),
		save: jest.fn(),
		create: jest.fn().mockImplementation((dto) => dto),
		merge: jest
			.fn()
			.mockImplementation((entity, dto) => ({ ...entity, ...dto })),
	};

	const mockCacheManager = {
		get: jest.fn(),
		set: jest.fn(),
		del: jest.fn(),
	};

	const mockAppConfig = {
		webauthnRpId: 'localhost',
		webauthnRpName: 'Gatuno',
		webauthnChallengeTtlMs: 60000,
		webauthnAllowedOrigins: ['http://localhost:3000'],
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				WebauthnService,
				{
					provide: getRepositoryToken(User),
					useValue: mockUserRepository,
				},
				{
					provide: getRepositoryToken(WebAuthnCredential),
					useValue: mockCredentialRepository,
				},
				{
					provide: AppConfigService,
					useValue: mockAppConfig,
				},
				{
					provide: CACHE_MANAGER,
					useValue: mockCacheManager,
				},
			],
		}).compile();

		service = module.get<WebauthnService>(WebauthnService);
		userRepository = module.get(getRepositoryToken(User));
		credentialRepository = module.get(
			getRepositoryToken(WebAuthnCredential),
		);
		cacheManager = module.get(CACHE_MANAGER);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('beginAuthentication', () => {
		it('should generate options for a specific user when email is provided', async () => {
			const email = 'user@example.com';
			const user = { id: 'user-1', email };
			const credentials = [
				{ credentialId: 'cred-1', transports: ['internal'] },
			];

			mockUserRepository.findOne.mockResolvedValue(user);
			mockCredentialRepository.find.mockResolvedValue(credentials);
			(generateAuthenticationOptions as jest.Mock).mockResolvedValue({
				challenge: 'test-challenge',
				allowCredentials: [{ id: 'cred-1' }],
			});

			const options = await service.beginAuthentication(email);

			expect(options.challenge).toBe('test-challenge');
			expect(mockCacheManager.set).toHaveBeenCalledWith(
				'webauthn:authenticate:challenge:user-1',
				'test-challenge',
				60000,
			);
		});

		it('should generate generic options when email is not provided (nameless flow)', async () => {
			(generateAuthenticationOptions as jest.Mock).mockResolvedValue({
				challenge: 'generic-challenge',
			});

			const options = await service.beginAuthentication();

			expect(options.challenge).toBe('generic-challenge');
			expect(mockCacheManager.set).toHaveBeenCalledWith(
				'webauthn:authenticate:challenge_str:generic-challenge',
				'generic-challenge',
				60000,
			);
			expect(mockUserRepository.findOne).not.toHaveBeenCalled();
		});

		it('should throw UnauthorizedException if user not found with email', async () => {
			mockUserRepository.findOne.mockResolvedValue(null);
			await expect(
				service.beginAuthentication('wrong@example.com'),
			).rejects.toThrow(UnauthorizedException);
		});
	});

	describe('verifyAuthentication', () => {
		const mockResponse = {
			id: 'cred-1',
			response: {
				clientDataJSON: Buffer.from(
					JSON.stringify({ challenge: 'test-challenge' }),
				).toString('base64url'),
			},
		};

		it('should verify nameless authentication successfully', async () => {
			const user = { id: 'user-1', email: 'user@example.com' };
			const credential = {
				credentialId: 'cred-1',
				publicKey: 'base64-pub-key',
				counter: 0,
				user,
			};

			mockCredentialRepository.findOne.mockResolvedValue(credential);
			mockCacheManager.get.mockResolvedValue('test-challenge');
			(verifyAuthenticationResponse as jest.Mock).mockResolvedValue({
				verified: true,
				authenticationInfo: { newCounter: 1 },
			});

			const result = await service.verifyAuthentication(
				undefined,
				mockResponse as any,
			);

			expect(result).toEqual(user);
			expect(mockCacheManager.get).toHaveBeenCalledWith(
				'webauthn:authenticate:challenge_str:test-challenge',
			);
			expect(mockCredentialRepository.save).toHaveBeenCalled();
		});

		it('should verify legacy authentication (by userId) if nameless challenge fails', async () => {
			const user = { id: 'user-1', email: 'user@example.com' };
			const credential = {
				credentialId: 'cred-1',
				publicKey: 'base64-pub-key',
				counter: 0,
				user,
			};

			mockCredentialRepository.findOne.mockResolvedValue(credential);
			// Primeira chamada (challenge_str) retorna null, segunda (userId) retorna challenge
			mockCacheManager.get
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce('legacy-challenge');

			(verifyAuthenticationResponse as jest.Mock).mockResolvedValue({
				verified: true,
				authenticationInfo: { newCounter: 1 },
			});

			const result = await service.verifyAuthentication(
				'user@example.com',
				mockResponse as any,
			);

			expect(result).toEqual(user);
			expect(mockCacheManager.get).toHaveBeenCalledWith(
				'webauthn:authenticate:challenge:user-1',
			);
		});

		it('should throw UnauthorizedException if email is provided but does not match credential owner', async () => {
			const user = { id: 'user-1', email: 'user@example.com' };
			const credential = { credentialId: 'cred-1', user };
			mockCredentialRepository.findOne.mockResolvedValue(credential);

			await expect(
				service.verifyAuthentication(
					'other@example.com',
					mockResponse as any,
				),
			).rejects.toThrow(UnauthorizedException);
		});

		it('should throw UnauthorizedException if challenge not found in cache', async () => {
			const user = { id: 'user-1', email: 'user@example.com' };
			const credential = { credentialId: 'cred-1', user };
			mockCredentialRepository.findOne.mockResolvedValue(credential);
			mockCacheManager.get.mockResolvedValue(null);

			await expect(
				service.verifyAuthentication(undefined, mockResponse as any),
			).rejects.toThrow(UnauthorizedException);
		});
	});
});
