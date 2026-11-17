import { AuthErrorCode } from '@auth/application/errors/auth-error';
import { RefreshInProgressException } from '@auth/domain/exceptions/refresh-in-progress.exception';
import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/** Seconds a client should wait before retrying a refresh that hit the lock. */
const RETRY_AFTER_SECONDS = 1;

/**
 * Answers a refresh that hit the held refresh lock with 409 and a
 * `Retry-After` hint: the session is alive, so the client should retry
 * rather than sign out. Catches nothing else.
 */
@Catch(RefreshInProgressException)
export class RefreshInProgressFilter implements ExceptionFilter {
	catch(exception: RefreshInProgressException, host: ArgumentsHost): void {
		host.switchToHttp()
			.getResponse<Response>()
			.setHeader('Retry-After', String(RETRY_AFTER_SECONDS))
			.status(HttpStatus.CONFLICT)
			.json({
				statusCode: HttpStatus.CONFLICT,
				error: 'Conflict',
				message: exception.message,
				code: AuthErrorCode.REFRESH_IN_PROGRESS,
			});
	}
}
