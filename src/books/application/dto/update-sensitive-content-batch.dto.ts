import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsUUID, ValidateNested } from 'class-validator';
import { UpdateSensitiveContentDto } from './update-sensitive-content.dto';

export class UpdateSensitiveContentItemDto extends UpdateSensitiveContentDto {
	@ApiProperty({
		description: 'Unique identifier of the sensitive content to update',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID()
	id: string;
}

export class UpdateSensitiveContentBatchDto {
	@ApiProperty({
		description: 'List of sensitive content items to update',
		type: [UpdateSensitiveContentItemDto],
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => UpdateSensitiveContentItemDto)
	items: UpdateSensitiveContentItemDto[];
}
