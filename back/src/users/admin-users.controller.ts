import {
	Body,
	Controller,
	DefaultValuePipe,
	Delete,
	Get,
	Param,
	ParseBoolPipe,
	ParseIntPipe,
	ParseUUIDPipe,
	Patch,
	Query,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { SetUserModerationDto } from './dto/set-user-moderation.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { RolesEnum } from './enum/roles.enum';
import { AdminUsersService } from './admin-users.service';

@ApiTags('Admin Users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminUsersController {
	constructor(private readonly adminUsersService: AdminUsersService) {}

	@Get()
	@ApiOperation({ summary: 'List users with admin filters' })
	@ApiResponse({ status: 200, description: 'Users listed successfully' })
	@ApiQuery({ name: 'page', required: false })
	@ApiQuery({ name: 'limit', required: false })
	@ApiQuery({ name: 'search', required: false })
	@ApiQuery({ name: 'role', required: false })
	@ApiQuery({ name: 'isBanned', required: false })
	@ApiQuery({ name: 'isSuspended', required: false })
	listUsers(
		@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
		@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
		@Query('search') search?: string,
		@Query('role') role?: string,
		@Query('isBanned', new ParseBoolPipe({ optional: true }))
		isBanned?: boolean,
		@Query('isSuspended', new ParseBoolPipe({ optional: true }))
		isSuspended?: boolean,
	) {
		return this.adminUsersService.listUsers({
			page,
			limit,
			search,
			role,
			isBanned,
			isSuspended,
		});
	}

	@Get(':userId')
	@ApiOperation({ summary: 'Get a user by id (admin)' })
	getUserById(@Param('userId', ParseUUIDPipe) userId: string) {
		return this.adminUsersService.getUserById(userId);
	}

	@Patch(':userId')
	@ApiOperation({ summary: 'Update user profile settings (admin)' })
	updateUser(
		@Param('userId', ParseUUIDPipe) userId: string,
		@Body() dto: AdminUpdateUserDto,
	) {
		return this.adminUsersService.updateUserByAdmin(userId, dto);
	}

	@Patch(':userId/roles')
	@ApiOperation({ summary: 'Replace roles from a user (admin)' })
	updateUserRoles(
		@Param('userId', ParseUUIDPipe) userId: string,
		@Body() dto: UpdateUserRolesDto,
		@CurrentUser() currentUser: CurrentUserDto,
	) {
		return this.adminUsersService.updateUserRoles(
			userId,
			dto,
			currentUser.userId,
		);
	}

	@Patch(':userId/moderation')
	@ApiOperation({ summary: 'Apply ban/suspension settings to user' })
	setModeration(
		@Param('userId', ParseUUIDPipe) userId: string,
		@Body() dto: SetUserModerationDto,
		@CurrentUser() currentUser: CurrentUserDto,
	) {
		return this.adminUsersService.setUserModeration(
			userId,
			dto,
			currentUser.userId,
		);
	}

	@Delete(':userId')
	@ApiOperation({ summary: 'Delete user account (admin)' })
	deleteUser(
		@Param('userId', ParseUUIDPipe) userId: string,
		@CurrentUser() currentUser: CurrentUserDto,
	) {
		return this.adminUsersService.deleteUserByAdmin(
			userId,
			currentUser.userId,
		);
	}
}
