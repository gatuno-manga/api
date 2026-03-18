import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';

export class BookChapterCursorItemDto {
	@ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
	id: string;

	@ApiProperty({ example: 'Capítulo 1' })
	title: string;

	@ApiProperty({ example: 1 })
	index: number;

	@ApiPropertyOptional({
		enum: ScrapingStatus,
		example: ScrapingStatus.READY,
		nullable: true,
	})
	scrapingStatus?: ScrapingStatus | null;

	@ApiProperty({ required: false, example: true })
	read?: boolean;
}

export class BookChaptersCursorPageDto {
	@ApiProperty({ type: [BookChapterCursorItemDto] })
	data: BookChapterCursorItemDto[];

	@ApiProperty({
		nullable: true,
		required: false,
		example: 'MjAwLjA=',
		description: 'Cursor da próxima página. Nulo quando não há mais itens.',
	})
	nextCursor: string | null;

	@ApiProperty({ example: true })
	hasNextPage: boolean;
}
