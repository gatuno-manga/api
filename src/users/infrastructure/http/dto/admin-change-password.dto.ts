import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class AdminChangePasswordDto {
	@ApiProperty({
		description: 'Nova senha do usuário',
		minLength: 8,
		example: 'NewSecurePassword123!',
	})
	@IsString()
	@IsNotEmpty()
	@MinLength(8)
	newPassword: string;
}
