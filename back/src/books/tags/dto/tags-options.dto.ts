import { IsOptional } from 'class-validator';
import { ToArray } from 'src/pages/decorator/to-array.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
