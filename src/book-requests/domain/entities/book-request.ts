import { BookRequestHeader } from '../value-objects/book-request-header.vo';
import {
	BookRequestBody,
	BookRequestOutcome,
	ResolutionDetails,
} from '../value-objects/book-request-body.vo';
import { BookRequestStatus } from '../enums/book-request-status.enum';
import { RejectionMessage } from '../value-objects/rejection-message.vo';

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
			throw new Error('Only pending requests can be processed');
		}
	}
}
