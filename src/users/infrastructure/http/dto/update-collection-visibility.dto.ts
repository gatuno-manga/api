import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateCollectionVisibilityDto {
	@ApiProperty({
		description: 'Whether the collection is publicly visible',
		example: true,
	})
	@IsBoolean()
	isPublic: boolean;
}
