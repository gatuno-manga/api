import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional } from 'class-validator';

export class AuthorsOptions {
	@ApiPropertyOptional({
		description: 'Filter authors by sensitive content in their books',
		example: ['violence', 'gore'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@IsArray()
	sensitiveContent?: string[] = [];
}
