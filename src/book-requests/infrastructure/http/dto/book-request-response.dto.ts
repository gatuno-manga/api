import { BookRequestStatus } from '@/book-requests/domain/enums/book-request-status.enum';

export class BookRequestResponseDto {
	id: string;
	userId: string;
	title: string;
	url: string;
	reason: string | null;
	status: BookRequestStatus;
	adminId: string | null;
	rejectionMessage: string | null;
	createdAt: Date;
	updatedAt: Date;
}
