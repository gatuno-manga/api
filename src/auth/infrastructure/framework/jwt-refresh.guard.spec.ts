import { HttpException, UnauthorizedException } from '@nestjs/common';
import { TokenExpiredError } from '@nestjs/jwt';
import { RefreshTokenGuard } from './jwt-refresh.guard';

describe('RefreshTokenGuard.handleRequest', () => {
	const guard = new RefreshTokenGuard();

	function responseOf(run: () => unknown) {
		try {
			run();
		} catch (error) {
			expect(error).toBeInstanceOf(UnauthorizedException);
			return (error as HttpException).getResponse();
		}
		throw new Error('Expected handleRequest to throw');
	}

	it('returns the user when the strategy accepted the token', () => {
		const user = { userId: 'user-1', email: 'a@b.c' };
		expect(guard.handleRequest(null, user, undefined)).toBe(user);
	});

	it('answers REFRESH_TOKEN_MISSING when passport found no token', () => {
		expect(
			responseOf(() =>
				guard.handleRequest(null, false, new Error('No auth token')),
			),
		).toEqual({
			statusCode: 401,
			error: 'Unauthorized',
			message: 'Unauthorized',
			code: 'REFRESH_TOKEN_MISSING',
		});
	});

	it('answers REFRESH_TOKEN_INVALID when the token failed verification', () => {
		expect(
			responseOf(() =>
				guard.handleRequest(
					null,
					false,
					new TokenExpiredError('jwt expired', new Date()),
				),
			),
		).toEqual({
			statusCode: 401,
			error: 'Unauthorized',
			message: 'Unauthorized',
			code: 'REFRESH_TOKEN_INVALID',
		});
	});

	it('answers REFRESH_TOKEN_INVALID when passport gives no reason', () => {
		expect(
			responseOf(() => guard.handleRequest(null, false, undefined)),
		).toMatchObject({ code: 'REFRESH_TOKEN_INVALID' });
	});

	it('rethrows an error raised by the strategy unchanged', () => {
		const strategyError = new UnauthorizedException({ code: 'X' });
		expect(() =>
			guard.handleRequest(strategyError, false, undefined),
		).toThrow(strategyError);
	});
});
