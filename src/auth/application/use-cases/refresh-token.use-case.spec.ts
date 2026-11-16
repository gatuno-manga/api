import type { SessionAuditService } from '@auth/infrastructure/adapters/session-audit.service';
import type { SessionManagementService } from '@auth/infrastructure/adapters/session-management.service';
import type { TokenStoreService } from '@auth/infrastructure/adapters/token-store.service';
import type { AuthRequestContext } from '@auth/types/auth-security.types';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { DataEncryptionProvider } from 'src/infrastructure/encryption/data-encryption.provider';
import type { User } from 'src/users/infrastructure/database/entities/user.entity';
import type { Repository } from 'typeorm';
import { RefreshTokenUseCase } from './refresh-token.use-case';

describe('RefreshTokenUseCase error codes', () => {
	const userRepository = { findOne: jest.fn() };
	const jwtService = { decode: jest.fn() };
	const tokenStore = {
		runWithRefreshLock: jest.fn(),
		getValidTokens: jest.fn(),
		revokeTokenFamily: jest.fn(),
		removeAllTokens: jest.fn(),
	};
	const sessionAudit = { track: jest.fn() };
	const sessionManagement = {
		revokeSessionsByFamily: jest.fn(),
		revokeAllSessions: jest.fn(),
	};
	const encryption = { compare: jest.fn() };
	const generateTokens = jest.fn();
	const context = {} as AuthRequestContext;

	const useCase = new RefreshTokenUseCase(
		userRepository as unknown as Repository<User>,
		jwtService as unknown as JwtService,
		tokenStore as unknown as TokenStoreService,
		sessionAudit as unknown as SessionAuditService,
		sessionManagement as unknown as SessionManagementService,
		encryption as unknown as DataEncryptionProvider,
	);

	const stored = {
		jti: 'jti-1',
		familyId: 'family-1',
		sessionId: 'session-1',
		hash: 'hash',
		expiresAt: Date.now() + 60_000,
	};

	async function codeOf(token = 'refresh-token') {
		const error = await useCase
			.execute('user-1', token, context, generateTokens)
			.then(
				() => {
					throw new Error('Expected execute to reject');
				},
				(rejection: unknown) => rejection,
			);
		expect(error).toBeInstanceOf(UnauthorizedException);
		return ((error as HttpException).getResponse() as { code?: string })
			.code;
	}

	beforeEach(() => {
		jest.resetAllMocks();
		tokenStore.runWithRefreshLock.mockImplementation(
			(_userId: string, operation: () => Promise<unknown>) => operation(),
		);
		tokenStore.getValidTokens.mockResolvedValue([{ ...stored }]);
		jwtService.decode.mockReturnValue({
			jti: 'jti-1',
			familyId: 'family-1',
			sessionId: 'session-1',
		});
		encryption.compare.mockResolvedValue(true);
		userRepository.findOne.mockResolvedValue({ id: 'user-1' });
	});

	it('answers REFRESH_TOKEN_MISSING for an empty token', async () => {
		expect(await codeOf('')).toBe('REFRESH_TOKEN_MISSING');
		expect(tokenStore.runWithRefreshLock).not.toHaveBeenCalled();
	});

	it('answers REFRESH_SESSION_NOT_FOUND when no token is stored', async () => {
		tokenStore.getValidTokens.mockResolvedValue([]);
		expect(await codeOf()).toBe('REFRESH_SESSION_NOT_FOUND');
	});

	it('answers REFRESH_TOKEN_INVALID when the token has no jti', async () => {
		jwtService.decode.mockReturnValue({});
		expect(await codeOf()).toBe('REFRESH_TOKEN_INVALID');
	});

	it('answers REFRESH_TOKEN_REUSED and revokes the family for an unknown jti', async () => {
		jwtService.decode.mockReturnValue({
			jti: 'rotated-jti',
			familyId: 'family-1',
		});
		expect(await codeOf()).toBe('REFRESH_TOKEN_REUSED');
		expect(tokenStore.revokeTokenFamily).toHaveBeenCalledWith(
			'user-1',
			'family-1',
			expect.any(Array),
		);
	});

	it('answers REFRESH_TOKEN_REUSED on a hash mismatch', async () => {
		encryption.compare.mockResolvedValue(false);
		expect(await codeOf()).toBe('REFRESH_TOKEN_REUSED');
	});

	it('answers REFRESH_USER_NOT_FOUND when the user was deleted', async () => {
		userRepository.findOne.mockResolvedValue(null);
		expect(await codeOf()).toBe('REFRESH_USER_NOT_FOUND');
		expect(generateTokens).not.toHaveBeenCalled();
	});
});
