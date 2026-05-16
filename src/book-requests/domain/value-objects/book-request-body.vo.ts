import { BookRequestReason } from './book-request-reason.vo';
import { BookRequestTitle } from './book-request-title.vo';
import { BookRequestUrl } from './book-request-url.vo';
import { BookRequestStatus } from '@/book-requests/domain/enums/book-request-status.enum';
import { RejectionMessage } from './rejection-message.vo';

export class BookInformation {
	constructor(
		public readonly title: BookRequestTitle,
		public readonly url: BookRequestUrl,
	) {}
}

export class ResolutionDetails {
	constructor(
		public readonly adminId: string | null,
		public readonly rejectionMessage: RejectionMessage,
	) {}
}

export class BookRequestProposition {
	constructor(
		public readonly info: BookInformation,
		public readonly reason: BookRequestReason,
	) {}
}

export class BookRequestOutcome {
	constructor(
		public readonly status: BookRequestStatus,
		public readonly resolution: ResolutionDetails,
	) {}
}

export class BookRequestBody {
	constructor(
		public readonly proposition: BookRequestProposition,
		public readonly outcome: BookRequestOutcome,
	) {}
}
