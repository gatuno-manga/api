import { DomainException } from '@common/domain/exceptions/domain.exception';

/**
 * The `cursor` of a book list request cannot continue that request: it is
 * malformed, or it was issued for another sort or for the other list path.
 */
export class InvalidBookListCursorException extends DomainException {
	constructor(reason: string) {
		super(`Invalid cursor: ${reason}`);
		this.name = 'InvalidBookListCursorException';
	}
}
