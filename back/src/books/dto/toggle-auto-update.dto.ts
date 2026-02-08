import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleAutoUpdateDto {
	@ApiProperty({
		description: 'Enable or disable automatic updates for the book',
		example: true,
		type: Boolean,
	})
	@IsBoolean()
	enabled: boolean;
}
