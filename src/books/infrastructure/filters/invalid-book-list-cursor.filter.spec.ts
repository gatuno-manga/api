import { InvalidBookListCursorException } from '@books/domain/exceptions/invalid-book-list-cursor.exception';
import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { InvalidBookListCursorFilter } from './invalid-book-list-cursor.filter';

describe('InvalidBookListCursorFilter', () => {
	const filter = new InvalidBookListCursorFilter();
	const exception = new InvalidBookListCursorException('malformed cursor');

	it('should answer REST requests with 400, since a bad cursor is a client error and not a server failure', () => {
		// Arrange
		const response = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
		};
		const host = {
			getType: () => 'http',
			switchToHttp: () => ({ getResponse: () => response }),
		} as unknown as ArgumentsHost;

		// Act
		filter.catch(exception, host);

		// Assert
		expect(response.status).toHaveBeenCalledWith(400);
		expect(response.json).toHaveBeenCalledWith({
			statusCode: 400,
			message: 'Invalid cursor: malformed cursor',
			error: 'Bad Request',
		});
	});

	it('should hand GraphQL a bad request error for the driver to report', () => {
		// Arrange
		const host = { getType: () => 'graphql' } as unknown as ArgumentsHost;

		// Act
		const result = filter.catch(exception, host);

		// Assert
		expect(result).toBeInstanceOf(BadRequestException);
		expect(result?.message).toBe('Invalid cursor: malformed cursor');
	});
});
