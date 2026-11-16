import { UnauthorizedException } from '@nestjs/common';

/**
 * Machine-readable `code` on auth error bodies, so clients can branch
 * without parsing `message`. On `POST /auth/refresh` every 401 means the
 * session is dead; any other status can be retried.
 */
export const AuthErrorCode = {
	REFRESH_IN_PROGRESS: 'REFRESH_IN_PROGRESS',
	REFRESH_TOKEN_MISSING: 'REFRESH_TOKEN_MISSING',
	REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
	REFRESH_SESSION_NOT_FOUND: 'REFRESH_SESSION_NOT_FOUND',
	REFRESH_TOKEN_REUSED: 'REFRESH_TOKEN_REUSED',
	REFRESH_USER_NOT_FOUND: 'REFRESH_USER_NOT_FOUND',
	CSRF_TOKEN_INVALID: 'CSRF_TOKEN_INVALID',
} as const;

export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

/** The refresh failures that mean the session is dead (answered with 401). */
export type RefreshUnauthorizedCode = (typeof AuthErrorCode)[
	| 'REFRESH_TOKEN_MISSING'
	| 'REFRESH_TOKEN_INVALID'
	| 'REFRESH_SESSION_NOT_FOUND'
	| 'REFRESH_TOKEN_REUSED'
	| 'REFRESH_USER_NOT_FOUND'];

/** A 401 with the default Nest body plus `code`. */
export function refreshUnauthorized(
	code: RefreshUnauthorizedCode,
	message: string,
): UnauthorizedException {
	return new UnauthorizedException({
		statusCode: 401,
		error: 'Unauthorized',
		message,
		code,
	});
}
