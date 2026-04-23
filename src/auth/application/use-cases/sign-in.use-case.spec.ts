import { UnauthorizedException } from '@nestjs/common';
import { PasswordEncryption } from 'src/infrastructure/encryption/password-encryption.provider';
import { SessionAuditService } from '../../infrastructure/adapters/session-audit.service';
import { UserRepositoryPort } from '../ports/user-repository.port';
import { SignInUseCase } from './sign-in.use-case';

describe('SignInUseCase', () => {
	let useCase: SignInUseCase;
	let userRepository: jest.Mocked<UserRepositoryPort>;
	let passwordEncryption: jest.Mocked<PasswordEncryption>;
	let sessionAudit: jest.Mocked<SessionAuditService>;

	beforeEach(() => {
		userRepository = {
			findByEmail: jest.fn(),
			findCredentialsByEmail: jest.fn(),
			save: jest.fn(),
		};

		passwordEncryption = {
			encrypt: jest.fn(),
			compare: jest.fn(),
			getAlgorithm: jest.fn(),
		} as unknown as jest.Mocked<PasswordEncryption>;

		sessionAudit = {
			track: jest.fn(),
			listUserAuditHistory: jest.fn(),
		} as unknown as jest.Mocked<SessionAuditService>;

		useCase = new SignInUseCase(
			userRepository,
			passwordEncryption,
			sessionAudit,
		);
	});

	it('deve autenticar com credenciais validas', async () => {
		const user = {
			id: 'user-1',
			email: 'user@example.com',
			password: 'hashed-password',
			userName: 'user',
			roles: [{ name: 'user' }],
		};
		const authResult = {
			accessToken: 'access-token',
			refreshToken: 'refresh-token',
			sessionId: 'session-id',
		};
		const issueAuthFlow = jest.fn().mockResolvedValue(authResult);

		userRepository.findCredentialsByEmail.mockResolvedValue(user);
		passwordEncryption.compare.mockResolvedValue(true);

		const result = await useCase.execute(
			'user@example.com',
			'plain-password',
			undefined,
			issueAuthFlow,
		);

		expect(userRepository.findCredentialsByEmail).toHaveBeenCalled();
		expect(passwordEncryption.compare).toHaveBeenCalledWith(
			'hashed-password',
			'plain-password',
		);
		expect(issueAuthFlow).toHaveBeenCalledWith(user, 'password', undefined);
		expect(result).toEqual(authResult);
	});

	it('deve rejeitar quando hash de senha nao esta disponivel', async () => {
		userRepository.findCredentialsByEmail.mockResolvedValue({
			id: 'user-1',
			email: 'user@example.com',
			userName: 'user',
			roles: [{ name: 'user' }],
		});

		await expect(
			useCase.execute('user@example.com', 'plain-password'),
		).rejects.toThrow(UnauthorizedException);

		expect(passwordEncryption.compare).not.toHaveBeenCalled();
		expect(sessionAudit.track).toHaveBeenCalledWith(
			expect.objectContaining({
				metadata: expect.objectContaining({
					reason: 'password_hash_unavailable',
				}),
			}),
		);
	});

	it('deve rejeitar senha invalida', async () => {
		userRepository.findCredentialsByEmail.mockResolvedValue({
			id: 'user-1',
			email: 'user@example.com',
			password: 'hashed-password',
			userName: 'user',
			roles: [{ name: 'user' }],
		});
		passwordEncryption.compare.mockResolvedValue(false);

		await expect(
			useCase.execute('user@example.com', 'wrong-password'),
		).rejects.toThrow(UnauthorizedException);

		expect(sessionAudit.track).toHaveBeenCalledWith(
			expect.objectContaining({
				metadata: expect.objectContaining({
					reason: 'invalid_password',
				}),
			}),
		);
	});

	it('deve rejeitar quando usuario nao existe', async () => {
		userRepository.findCredentialsByEmail.mockResolvedValue(null);

		await expect(
			useCase.execute('missing@example.com', 'plain-password'),
		).rejects.toThrow(UnauthorizedException);

		expect(sessionAudit.track).toHaveBeenCalledWith(
			expect.objectContaining({
				metadata: expect.objectContaining({
					reason: 'user_not_found',
				}),
			}),
		);
	});
});
