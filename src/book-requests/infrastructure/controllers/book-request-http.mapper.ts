import { BookRequest } from '../../domain/entities/book-request';
import { BookRequestResponseDto } from '../http/dto/book-request-response.dto';

export function mapBookRequestToResponseDto(
	domain: BookRequest,
): BookRequestResponseDto {
	return {
		id: domain.header.identity.id,
		userId: domain.header.identity.userId,
		title: domain.body.proposition.info.title.getValue(),
		url: domain.body.proposition.info.url.getValue(),
		reason: domain.body.proposition.reason.getValue(),
		status: domain.body.outcome.status,
		adminId: domain.body.outcome.resolution.adminId,
		rejectionMessage:
			domain.body.outcome.resolution.rejectionMessage.getValue(),
		createdAt: domain.header.timing.createdAt,
		updatedAt: domain.header.timing.updatedAt,
	};
}

export function mapBookRequestToResponseDtoList(
	domainList: BookRequest[],
): BookRequestResponseDto[] {
	return domainList.map((item) => mapBookRequestToResponseDto(item));
}
