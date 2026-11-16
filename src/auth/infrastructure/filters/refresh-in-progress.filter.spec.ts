import { RefreshInProgressException } from '@auth/domain/exceptions/refresh-in-progress.exception';
import type { ArgumentsHost } from '@nestjs/common';
import { RefreshInProgressFilter } from './refresh-in-progress.filter';

describe('RefreshInProgressFilter', () => {
	it('answers 409 REFRESH_IN_PROGRESS with a Retry-After hint', () => {
		const response = {
			setHeader: jest.fn(),
			status: jest.fn(),
			json: jest.fn(),
		};
		response.setHeader.mockReturnValue(response);
		response.status.mockReturnValue(response);
		const host = {
			switchToHttp: () => ({ getResponse: () => response }),
		} as unknown as ArgumentsHost;

		new RefreshInProgressFilter().catch(
			new RefreshInProgressException(),
			host,
		);

		expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '1');
		expect(response.status).toHaveBeenCalledWith(409);
		expect(response.json).toHaveBeenCalledWith({
			statusCode: 409,
			error: 'Conflict',
			message: 'Refresh already in progress',
			code: 'REFRESH_IN_PROGRESS',
		});
	});
});
