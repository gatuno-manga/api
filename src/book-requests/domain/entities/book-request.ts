import { BookRequestStatus } from '@/book-requests/domain/enums/book-request-status.enum';
import {
	BookRequestBody,
	BookRequestOutcome,
	ResolutionDetails,
} from '@/book-requests/domain/value-objects/book-request-body.vo';
import { BookRequestHeader } from '@/book-requests/domain/value-objects/book-request-header.vo';
import { RejectionMessage } from '@/book-requests/domain/value-objects/rejection-message.vo';
import { DomainException } from '@common/domain/exceptions/domain.exception';

export class BookRequest {
	constructor(
		public readonly header: BookRequestHeader,
		public readonly body: BookRequestBody,
	) {}

	approve(adminId: string): BookRequest {
		this.ensureIsPending();

		const approvedOutcome = new BookRequestOutcome(
			BookRequestStatus.APPROVED,
			new ResolutionDetails(adminId, new RejectionMessage(null)),
		);

		return new BookRequest(
			this.header,
			new BookRequestBody(this.body.proposition, approvedOutcome),
		);
	}

	reject(adminId: string, message: string | null): BookRequest {
		this.ensureIsPending();

		const rejectedOutcome = new BookRequestOutcome(
			BookRequestStatus.REJECTED,
			new ResolutionDetails(adminId, new RejectionMessage(message)),
		);

		return new BookRequest(
			this.header,
			new BookRequestBody(this.body.proposition, rejectedOutcome),
		);
	}

	private ensureIsPending(): void {
		if (this.body.outcome.status !== BookRequestStatus.PENDING) {
			throw new DomainException('Only pending requests can be processed');
		}
	}
}
