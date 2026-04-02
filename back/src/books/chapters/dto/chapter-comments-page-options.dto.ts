import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PageOptionsDto } from 'src/pages/page-options.dto';

export class ChapterCommentsPageOptionsDto extends PageOptionsDto {
	@ApiPropertyOptional({
		description:
			'Maximum nesting depth for replies in response tree (applies to current page roots)',
		example: 10,
		minimum: 1,
		maximum: 20,
		default: 10,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(20)
	maxDepth = 10;
}
