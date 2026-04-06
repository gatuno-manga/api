import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class ToggleAutoUpdateDto {
	@ApiProperty({
		description: 'Enable or disable automatic updates for the book',
		example: true,
		type: Boolean,
	})
	@Type(() => Boolean)
	@IsBoolean()
	enabled: boolean;
}
