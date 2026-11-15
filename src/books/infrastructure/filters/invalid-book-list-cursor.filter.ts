import { InvalidBookListCursorException } from '@books/domain/exceptions/invalid-book-list-cursor.exception';
import {
	ArgumentsHost,
	BadRequestException,
	Catch,
	ExceptionFilter,
} from '@nestjs/common';
import { Response } from 'express';

/** Answers a book list cursor that cannot continue the request with a 400. */
@Catch(InvalidBookListCursorException)
export class InvalidBookListCursorFilter implements ExceptionFilter {
	catch(
		exception: InvalidBookListCursorException,
		host: ArgumentsHost,
	): BadRequestException | undefined {
		const badRequest = new BadRequestException(exception.message);

		// A GraphQL filter returns the error and the driver reports it.
		if (host.getType<string>() === 'graphql') return badRequest;

		host.switchToHttp()
			.getResponse<Response>()
			.status(badRequest.getStatus())
			.json(badRequest.getResponse());
		return undefined;
	}
}
