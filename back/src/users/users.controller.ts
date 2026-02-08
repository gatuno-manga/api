import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Patch()
	@ApiOperation({
		summary: 'Update user profile',
		description: 'Update current user information',
	})
	@ApiResponse({ status: 200, description: 'User successfully updated' })
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiBearerAuth('JWT-auth')
	async updateUser(
		@Body() dto: UpdateUserDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.usersService.updateUser(dto, user.userId);
	}
}
