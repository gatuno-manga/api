import { ApiProperty } from '@nestjs/swagger';
import { Book } from '../entities/book.entity';

export class RelatedBookItemDto {
	@ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
	relationId: string;

	@ApiProperty({ example: 'sequence' })
	relationType: string;

	@ApiProperty({ example: true })
	isBidirectional: boolean;

	@ApiProperty({ nullable: true, example: 1 })
	order: number | null;

	@ApiProperty({
		nullable: true,
		example: { note: 'Spin-off principal', weight: 90 },
	})
	metadata: { note?: string; weight?: number } | null;

	@ApiProperty({ enum: ['incoming', 'outgoing'] })
	direction: 'incoming' | 'outgoing';

	@ApiProperty({ type: Object })
	relatedBook: Book;
}

export class BookRelationshipsPageDto {
	@ApiProperty({ example: 1 })
	total: number;

	@ApiProperty({ example: 20 })
	limit: number;

	@ApiProperty({ example: 0 })
	offset: number;

	@ApiProperty({ type: [RelatedBookItemDto] })
	items: RelatedBookItemDto[];
}
