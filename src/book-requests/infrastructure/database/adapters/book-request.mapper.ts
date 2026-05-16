import { BookRequest } from '@/book-requests/domain/entities/book-request';
import { BookRequestEntity } from '@/book-requests/infrastructure/database/entities/book-request.entity';
import {
	BookRequestHeader,
	BookRequestIdentity,
	BookRequestTiming,
} from '@/book-requests/domain/value-objects/book-request-header.vo';
import {
	BookRequestBody,
	BookRequestProposition,
	BookInformation,
	BookRequestOutcome,
	ResolutionDetails,
} from '@/book-requests/domain/value-objects/book-request-body.vo';
import { BookRequestTitle } from '@/book-requests/domain/value-objects/book-request-title.vo';
import { BookRequestUrl } from '@/book-requests/domain/value-objects/book-request-url.vo';
import { BookRequestReason } from '@/book-requests/domain/value-objects/book-request-reason.vo';
import { RejectionMessage } from '@/book-requests/domain/value-objects/rejection-message.vo';

export function mapBookRequestToDomain(entity: BookRequestEntity): BookRequest {
	return new BookRequest(
		new BookRequestHeader(
			new BookRequestIdentity(entity.id, entity.userId),
			new BookRequestTiming(entity.createdAt, entity.updatedAt),
		),
		new BookRequestBody(
			new BookRequestProposition(
				new BookInformation(
					new BookRequestTitle(entity.title),
					new BookRequestUrl(entity.url),
				),
				new BookRequestReason(entity.reason),
			),
			new BookRequestOutcome(
				entity.status,
				new ResolutionDetails(
					entity.adminId,
					new RejectionMessage(entity.rejectionMessage),
				),
			),
		),
	);
}

export function mapBookRequestToEntity(domain: BookRequest): BookRequestEntity {
	const entity = new BookRequestEntity();
	entity.id = domain.header.identity.id;
	entity.userId = domain.header.identity.userId;
	entity.title = domain.body.proposition.info.title.getValue();
	entity.url = domain.body.proposition.info.url.getValue();
	entity.reason = domain.body.proposition.reason.getValue();
	entity.status = domain.body.outcome.status;
	entity.adminId = domain.body.outcome.resolution.adminId;
	entity.rejectionMessage =
		domain.body.outcome.resolution.rejectionMessage.getValue();
	entity.createdAt = domain.header.timing.createdAt;
	entity.updatedAt = domain.header.timing.updatedAt;
	return entity;
}
