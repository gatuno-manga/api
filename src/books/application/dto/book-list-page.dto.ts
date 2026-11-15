import { BookType } from '@books/domain/enums/book-type.enum';
import { ExportFormat } from '@books/domain/enums/export-format.enum';
import { PublicationStatus } from '@books/domain/enums/publication-status.enum';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CursorPageDto } from 'src/common/pagination/cursor-page.dto';
import { MetadataPageDto } from 'src/common/pagination/metadata-page.dto';
import { PageDto } from 'src/common/pagination/page.dto';

/**
 * Swagger-only description of a `GET /books` item. The service returns the
 * book entity spread with the resolved cover; these classes document that
 * shape and are not used to serialize the response.
 */
class LocalizedNameDto {
	@ApiProperty({ example: 'Ação' })
	name: string;

	@ApiProperty({ example: 'pt-BR' })
	languageCode: string;
}

export class BookListTagDto {
	@ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
	id: string;

	@ApiProperty({ example: 'Action' })
	name: string;

	@ApiProperty({ type: [LocalizedNameDto], nullable: true })
	altNames: LocalizedNameDto[] | null;

	@ApiProperty({ type: [String], nullable: true, example: ['acao'] })
	aliases: string[] | null;

	@ApiProperty({ nullable: true, example: 'Lutas e aventura' })
	description: string | null;
}

export class BookListSensitiveContentDto {
	@ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
	id: string;

	@ApiProperty({ example: 'Gore' })
	name: string;

	@ApiProperty({ type: [LocalizedNameDto], nullable: true })
	altNames: LocalizedNameDto[] | null;

	@ApiProperty({ type: [String], nullable: true, example: ['violencia'] })
	aliases: string[] | null;

	@ApiProperty({
		example: 3,
		description: 'Compared with the user maximum weight when filtering',
	})
	weight: number;
}

export class BookListAuthorDto {
	@ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
	id: string;

	@ApiProperty({ example: 'Chugong' })
	name: string;

	@ApiProperty()
	createdAt: Date;

	@ApiProperty()
	updatedAt: Date;
}

class BookListCoverDto {
	@ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
	id: string;

	@ApiProperty({ example: 'ab/cover.webp' })
	url: string;

	@ApiProperty({ example: 'Volume 1' })
	title: string;

	@ApiProperty({ example: true })
	selected: boolean;

	@ApiProperty({ type: Object, nullable: true })
	metadata: Record<string, unknown> | null;

	@ApiProperty({ type: [Object], nullable: true })
	variants: Record<string, unknown>[] | null;

	@ApiProperty({ example: 0 })
	index: number;

	@ApiProperty({ nullable: true })
	imageHash: string | null;

	@ApiProperty({ nullable: true, example: 'https://example.com/cover.jpg' })
	originalUrl: string | null;

	@ApiProperty({ enum: ScrapingStatus, nullable: true })
	scrapingStatus: ScrapingStatus | null;

	@ApiProperty({ example: 0 })
	retries: number;

	@ApiProperty()
	createdAt: Date;

	@ApiProperty()
	updatedAt: Date;

	@ApiProperty({ nullable: true })
	deletedAt: Date | null;
}

class BookListAlternativeTitleDto {
	@ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
	id: string;

	@ApiProperty({ example: 'Na Honjaman Level Up' })
	title: string;

	@ApiProperty({ nullable: true, example: 'ko' })
	languageCode: string | null;

	@ApiProperty({ example: 0 })
	rank: number;
}

class BookListDescriptionDto {
	@ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
	id: string;

	@ApiProperty({ example: 'Um caçador fraco...' })
	description: string;

	@ApiProperty({ example: 'pt-BR' })
	languageCode: string;

	@ApiProperty({ example: 0 })
	rank: number;

	@ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
	bookId: string;
}

export class BookListItemDto {
	@ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
	id: string;

	@ApiProperty({
		example: 'Solo Leveling',
		description: 'Title resolved for the requested language',
	})
	title: string;

	@ApiPropertyOptional({
		nullable: true,
		description: 'Description resolved for the requested language',
	})
	description?: string | null;

	@ApiProperty({
		example: 'https://cdn.example.com/books/ab/cover_w300.webp',
		description: 'Smallest available rendition of the selected cover',
	})
	cover: string;

	@ApiProperty({ type: Object, nullable: true })
	coverMetadata: Record<string, unknown> | null;

	@ApiProperty({
		type: [BookListCoverDto],
		description: 'Selected cover only',
	})
	covers: BookListCoverDto[];

	@ApiProperty({ type: [BookListAlternativeTitleDto] })
	alternativeTitles: BookListAlternativeTitleDto[];

	@ApiProperty({ type: [BookListDescriptionDto] })
	localizedDescriptions: BookListDescriptionDto[];

	@ApiProperty({
		type: [BookListTagDto],
		description: 'Always present; empty when the book has no tags',
	})
	tags: BookListTagDto[];

	@ApiProperty({
		type: [BookListAuthorDto],
		description:
			'Always present; empty when the book has no authors. Biographies are only returned by GET /books/:id',
	})
	authors: BookListAuthorDto[];

	@ApiProperty({
		type: [BookListSensitiveContentDto],
		description: 'Always present; empty when the book has none',
	})
	sensitiveContent: BookListSensitiveContentDto[];

	@ApiProperty({ enum: BookType })
	type: BookType;

	@ApiProperty({ type: [String], nullable: true })
	searchTerms: string[] | null;

	@ApiProperty({ type: [String], nullable: true })
	originalUrl: string[] | null;

	@ApiProperty({ nullable: true, example: 2018 })
	publication: number | null;

	@ApiProperty({ enum: ScrapingStatus })
	scrapingStatus: ScrapingStatus;

	@ApiProperty({ enum: PublicationStatus })
	publicationStatus: PublicationStatus;

	@ApiProperty({ example: false })
	autoUpdate: boolean;

	@ApiProperty({ nullable: true })
	lastChapterAddedAt: Date | null;

	@ApiProperty({ nullable: true })
	nextScrapeAt: Date | null;

	@ApiProperty({ example: 0 })
	completedCheckCount: number;

	@ApiProperty({ nullable: true, example: 'ko' })
	originalLanguageCode: string | null;

	@ApiProperty({ type: [String], nullable: true, example: ['pt-BR'] })
	availableChapterLanguages: string[] | null;

	@ApiProperty({ type: [String], nullable: true, example: ['pt-BR'] })
	allowedScrapingLanguages: string[] | null;

	@ApiProperty({
		type: 'array',
		nullable: true,
		items: {
			type: 'object',
			properties: {
				language: { type: 'string', example: 'pt-BR' },
				count: { type: 'number', example: 200 },
			},
		},
	})
	chaptersPerLanguage: Array<{ language: string; count: number }> | null;

	@ApiProperty({ example: 200 })
	totalChapters: number;

	@ApiProperty({ enum: ExportFormat, isArray: true, nullable: true })
	availableFormats: ExportFormat[] | null;

	@ApiProperty()
	createdAt: Date;

	@ApiProperty()
	updatedAt: Date;

	@ApiProperty({ nullable: true })
	deletedAt: Date | null;
}

export class BookListPageDto extends PageDto<BookListItemDto> {
	@ApiProperty({ type: [BookListItemDto] })
	declare data: BookListItemDto[];

	@ApiProperty({ type: MetadataPageDto })
	declare metadata: MetadataPageDto;
}

export class BookListCursorPageDto extends CursorPageDto<BookListItemDto> {
	@ApiProperty({ type: [BookListItemDto] })
	declare data: BookListItemDto[];
}
