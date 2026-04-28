import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ShareCollectionDto {
	@ApiProperty({ example: 'user-uuid-here' })
	@IsUUID()
	collaboratorId: string;
}
