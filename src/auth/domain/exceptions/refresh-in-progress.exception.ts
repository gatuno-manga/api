import { DomainException } from '@common/domain/exceptions/domain.exception';

/**
 * Another refresh for the same user holds the refresh lock. The session is
 * still alive, so the client may retry once the other refresh finishes.
 */
export class RefreshInProgressException extends DomainException {
	constructor() {
		super('Refresh already in progress');
		this.name = 'RefreshInProgressException';
	}
}
