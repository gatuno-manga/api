import { BookRequestStatus } from '@/book-requests/domain/enums/book-request-status.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookRequestResponseDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	userId: string;

	@ApiProperty()
	title: string;

	@ApiProperty()
	url: string;

	@ApiPropertyOptional({ type: String, nullable: true })
	reason: string | null;

	@ApiProperty({ enum: BookRequestStatus })
	status: BookRequestStatus;

	@ApiPropertyOptional({ type: String, nullable: true })
	adminId: string | null;

	@ApiPropertyOptional({ type: String, nullable: true })
	rejectionMessage: string | null;

	@ApiProperty()
	createdAt: Date;

	@ApiProperty()
	updatedAt: Date;
}
