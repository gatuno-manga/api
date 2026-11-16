import {
	AuthErrorCode,
	refreshUnauthorized,
} from '@auth/application/errors/auth-error';
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** passport-jwt's failure reason when the request carries no token. */
const NO_TOKEN_REASON = 'No auth token';

/**
 * Authenticates `POST /auth/refresh` (and logout) with the refresh cookie.
 * Failures from passport-jwt itself (no cookie, bad signature, expired, wrong
 * issuer or audience) get a refresh `code`; errors raised by
 * `JwtRefreshStrategy.validate` already carry one and pass through.
 */
@Injectable()
export class RefreshTokenGuard extends AuthGuard('jwt-refresh') {
	handleRequest<TUser>(
		err: Error | null | undefined,
		user: TUser,
		info: unknown,
	): TUser {
		if (err) throw err;
		if (user) return user;

		const reason = info instanceof Error ? info.message : undefined;
		throw refreshUnauthorized(
			reason === NO_TOKEN_REASON
				? AuthErrorCode.REFRESH_TOKEN_MISSING
				: AuthErrorCode.REFRESH_TOKEN_INVALID,
			'Unauthorized',
		);
	}
}
