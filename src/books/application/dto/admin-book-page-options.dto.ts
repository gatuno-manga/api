import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ToArray } from 'src/common/pagination/decorator/to-array.decorator';
import { BookPageOptionsDto } from './book-page-options.dto';

export class AdminBookPageOptionsDto extends BookPageOptionsDto {
	@ApiPropertyOptional({
		description:
			'Filtro exclusivo para Admin: Buscar por status de scraping',
		enum: ScrapingStatus,
		isArray: true,
	})
	@IsOptional()
	@ToArray()
	@IsEnum(ScrapingStatus, { each: true })
	scrapingStatus?: ScrapingStatus[];
}
