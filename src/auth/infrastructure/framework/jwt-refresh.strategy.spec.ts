import type { PayloadAuthDto } from '@auth/application/dto/payload-auth.dto';
import type { TokenStoreService } from '@auth/infrastructure/adapters/token-store.service';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import type { DataEncryptionProvider } from 'src/infrastructure/encryption/data-encryption.provider';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';

describe('JwtRefreshStrategy.validate', () => {
	const tokenStore = { getValidTokens: jest.fn() };
	const encryption = { compare: jest.fn() };
	const config = {
		jwt: {
			refreshSecret: 'refresh-secret',
			issuer: 'issuer',
			audience: 'audience',
		},
	};
	const strategy = new JwtRefreshStrategy(
		config as unknown as AppConfigService,
		encryption as unknown as DataEncryptionProvider,
		tokenStore as unknown as TokenStoreService,
	);

	const request = (refreshToken?: string) =>
		({ cookies: refreshToken ? { refreshToken } : {} }) as Request;
	const payload = {
		sub: 'user-1',
		email: 'a@b.c',
		jti: 'jti-1',
		familyId: 'family-1',
	} as PayloadAuthDto;
	const stored = {
		jti: 'jti-1',
		familyId: 'family-1',
		hash: 'hash',
		expiresAt: Date.now() + 60_000,
	};

	async function codeOf(promise: Promise<unknown>) {
		const error = await promise.then(
			() => {
				throw new Error('Expected validate to reject');
			},
			(rejection: unknown) => rejection,
		);
		expect(error).toBeInstanceOf(UnauthorizedException);
		return ((error as HttpException).getResponse() as { code?: string })
			.code;
	}

	beforeEach(() => {
		jest.resetAllMocks();
		tokenStore.getValidTokens.mockResolvedValue([stored]);
		encryption.compare.mockResolvedValue(true);
	});

	it('returns the user when the token is stored and matches', async () => {
		await expect(
			strategy.validate(request('rt'), payload),
		).resolves.toEqual({ userId: 'user-1', email: 'a@b.c' });
	});

	it('answers REFRESH_TOKEN_MISSING without a refresh cookie', async () => {
		expect(await codeOf(strategy.validate(request(), payload))).toBe(
			'REFRESH_TOKEN_MISSING',
		);
	});

	it('answers REFRESH_TOKEN_INVALID for a payload without jti', async () => {
		expect(
			await codeOf(
				strategy.validate(request('rt'), {
					...payload,
					jti: undefined,
				}),
			),
		).toBe('REFRESH_TOKEN_INVALID');
	});

	it('answers REFRESH_SESSION_NOT_FOUND when the user has no stored token', async () => {
		tokenStore.getValidTokens.mockResolvedValue([]);
		expect(await codeOf(strategy.validate(request('rt'), payload))).toBe(
			'REFRESH_SESSION_NOT_FOUND',
		);
	});

	it('answers REFRESH_TOKEN_INVALID for an unknown jti', async () => {
		tokenStore.getValidTokens.mockResolvedValue([
			{ ...stored, jti: 'other' },
		]);
		expect(await codeOf(strategy.validate(request('rt'), payload))).toBe(
			'REFRESH_TOKEN_INVALID',
		);
	});

	it('answers REFRESH_TOKEN_INVALID on a hash mismatch', async () => {
		encryption.compare.mockResolvedValue(false);
		expect(await codeOf(strategy.validate(request('rt'), payload))).toBe(
			'REFRESH_TOKEN_INVALID',
		);
	});
});
