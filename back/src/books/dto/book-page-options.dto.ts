import { PageOptionsDto } from 'src/pages/page-options.dto';
import { BookType } from '../enum/book-type.enum';
import { ToArray } from 'src/pages/decorator/to-array.decorator';
import { IsOptional } from 'class-validator';

export class BookPageOptionsDto extends PageOptionsDto {
	@IsOptional()
	@ToArray()
	type?: BookType[] = [
		BookType.OTHER,
		BookType.MANGA,
		BookType.MANHWA,
		BookType.MANHUA,
		BookType.BOOK,
	];

	@IsOptional()
	@ToArray()
	sensitiveContent?: string[] = [];
}
