import { PageOptionsDto } from 'src/pages/page-options.dto';
import { BookType } from '../enum/book-type.enum';
import { SensitiveContent } from '../enum/sensitive-content.enum';
import { Type } from 'class-transformer';
import { IsOptional } from 'class-validator';

export class BookPageOptionsDto extends PageOptionsDto {
	@IsOptional()
	@Type(() => String)
	type?: BookType[] = [
		BookType.OTHER,
		BookType.MANGA,
		BookType.MANHWA,
		BookType.MANHUA,
		BookType.BOOK,
	];

	@IsOptional()
	@Type(() => String)
	sensitiveContent?: SensitiveContent[] = [
		SensitiveContent.SAFE,
	];
}
