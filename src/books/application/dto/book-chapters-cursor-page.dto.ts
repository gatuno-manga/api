import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CursorPageDto } from 'src/common/pagination/cursor-page.dto';

export class BookChapterCursorItemDto {
	@ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
	id: string;

	@ApiProperty({ example: 'Capítulo 1' })
	title: string;

	@ApiProperty({ example: 1 })
	index: number;

	@ApiProperty({ example: 'pt-BR' })
	languageCode: string;

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

	@ApiProperty({
		type: [String],
		description: 'List of language codes available for these chapters',
	})
	availableLanguages: string[];

	constructor(
		data: BookChapterCursorItemDto[],
		nextCursor: string | null,
		hasNextPage: boolean,
		availableLanguages: string[],
	) {
		super(data, nextCursor, hasNextPage);
		this.availableLanguages = availableLanguages;
	}
}
