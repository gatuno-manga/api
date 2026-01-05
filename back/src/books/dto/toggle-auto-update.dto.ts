import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleAutoUpdateDto {
    @ApiProperty({
        description: 'Enable or disable automatic updates for the book',
        example: true,
        type: Boolean,
    })
    @IsBoolean()
    enabled: boolean;
}
