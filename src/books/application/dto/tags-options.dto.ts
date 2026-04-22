import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { ToArray } from 'src/common/pagination/decorator/to-array.decorator';

export class TagsOptions {
	@ApiPropertyOptional({
		description: 'Filter tags by sensitive content',
		example: ['violence', 'gore'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@ToArray()
	sensitiveContent?: string[] = [];
}
