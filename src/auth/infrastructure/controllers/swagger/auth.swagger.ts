import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';

export function ApiDocsSignUp() {
	return applyDecorators(
		ApiOperation({
			summary: 'Create a new user account',
			description: 'Register a new user with email and password',
		}),
		ApiResponse({ status: 201, description: 'User successfully created' }),
		ApiResponse({ status: 400, description: 'Invalid input data' }),
		ApiResponse({ status: 409, description: 'Email already exists' }),
		ApiResponse({ status: 429, description: 'Too many requests' }),
	);
}

export function ApiDocsSignIn() {
	return applyDecorators(
		ApiOperation({
			summary: 'Sign in to user account',
			description: 'Authenticate user and receive access tokens',
		}),
		ApiResponse({ status: 200, description: 'Successfully authenticated' }),
		ApiResponse({ status: 401, description: 'Invalid credentials' }),
		ApiResponse({ status: 429, description: 'Too many requests' }),
	);
}

export function ApiDocsCreateLoginApiKey() {
	return applyDecorators(
		ApiOperation({
			summary: 'Create temporary login API key',
			description:
				'Create a temporary API key for admin self-login replacement',
		}),
		ApiResponse({
			status: 201,
			description: 'Login API key created successfully',
		}),
		ApiResponse({
			status: 401,
			description: 'Unauthorized',
		}),
		ApiResponse({
			status: 403,
			description: 'Forbidden',
		}),
		ApiBearerAuth(SWAGGER_AUTH_SCHEME),
	);
}

export function ApiDocsSignInWithApiKey() {
	return applyDecorators(
		ApiOperation({
			summary: 'Sign in using a temporary API key',
			description: 'Authenticate user with API key and return tokens',
		}),
		ApiResponse({ status: 200, description: 'Successfully authenticated' }),
		ApiResponse({ status: 401, description: 'Invalid API key' }),
		ApiResponse({ status: 429, description: 'Too many requests' }),
	);
}

export function ApiDocsRefreshTokens() {
	return applyDecorators(
		ApiOperation({
			summary: 'Refresh access token',
			description: 'Get a new access token using refresh token',
		}),
		ApiResponse({
			status: 200,
			description: 'Token refreshed successfully',
		}),
		ApiResponse({
			status: 401,
			description: 'Invalid or expired refresh token',
		}),
		ApiResponse({ status: 429, description: 'Too many requests' }),
		ApiBearerAuth(SWAGGER_AUTH_SCHEME),
	);
}

export function ApiDocsLogout() {
	return applyDecorators(
		ApiOperation({
			summary: 'Logout from current session',
			description: 'Invalidate the current refresh token',
		}),
		ApiResponse({ status: 200, description: 'Successfully logged out' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({ status: 429, description: 'Too many requests' }),
		ApiBearerAuth(SWAGGER_AUTH_SCHEME),
	);
}

export function ApiDocsLogoutAll() {
	return applyDecorators(
		ApiOperation({
			summary: 'Logout from all sessions',
			description: 'Invalidate all refresh tokens for the user',
		}),
		ApiResponse({
			status: 200,
			description: 'Successfully logged out from all sessions',
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({ status: 429, description: 'Too many requests' }),
		ApiBearerAuth(SWAGGER_AUTH_SCHEME),
	);
}

export function ApiDocsGetMfaStatus() {
	return applyDecorators(ApiBearerAuth(SWAGGER_AUTH_SCHEME));
}

export function ApiDocsBeginTotpSetup() {
	return applyDecorators(ApiBearerAuth(SWAGGER_AUTH_SCHEME));
}

export function ApiDocsVerifyTotpSetup() {
	return applyDecorators(ApiBearerAuth(SWAGGER_AUTH_SCHEME));
}

export function ApiDocsDisableTotp() {
	return applyDecorators(ApiBearerAuth(SWAGGER_AUTH_SCHEME));
}

export function ApiDocsListPasskeys() {
	return applyDecorators(ApiBearerAuth(SWAGGER_AUTH_SCHEME));
}

export function ApiDocsBeginPasskeyRegistration() {
	return applyDecorators(ApiBearerAuth(SWAGGER_AUTH_SCHEME));
}

export function ApiDocsVerifyPasskeyRegistration() {
	return applyDecorators(ApiBearerAuth(SWAGGER_AUTH_SCHEME));
}

export function ApiDocsDeletePasskey() {
	return applyDecorators(ApiBearerAuth(SWAGGER_AUTH_SCHEME));
}

export function ApiDocsListSessions() {
	return applyDecorators(ApiBearerAuth(SWAGGER_AUTH_SCHEME));
}

export function ApiDocsRevokeOtherSessions() {
	return applyDecorators(ApiBearerAuth(SWAGGER_AUTH_SCHEME));
}

export function ApiDocsRevokeSession() {
	return applyDecorators(ApiBearerAuth(SWAGGER_AUTH_SCHEME));
}

export function ApiDocsGetAuditHistory() {
	return applyDecorators(ApiBearerAuth(SWAGGER_AUTH_SCHEME));
}
