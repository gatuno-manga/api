import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CursorPageDto } from 'src/pages/cursor-page.dto';
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

export class BookChaptersCursorPageDto extends CursorPageDto<BookChapterCursorItemDto> {
	@ApiProperty({ type: [BookChapterCursorItemDto] })
	declare data: BookChapterCursorItemDto[];
}
