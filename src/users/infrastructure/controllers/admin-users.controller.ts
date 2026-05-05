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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { AdminApi } from 'src/common/swagger/auth-api.decorators';
import { AdminUpdateUserDto } from '../http/dto/admin-update-user.dto';
import { SetUserModerationDto } from '../http/dto/set-user-moderation.dto';
import { UpdateUserRolesDto } from '../http/dto/update-user-roles.dto';
import { AdminChangePasswordDto } from '../http/dto/admin-change-password.dto';
import { AdminUsersService } from '../../application/use-cases/admin-users.service';
import {
	ApiDocsSearch,
	ApiDocsListUsers,
	ApiDocsGetUserById,
	ApiDocsUpdateUser,
	ApiDocsUpdateUserRoles,
	ApiDocsChangePassword,
	ApiDocsSetModeration,
	ApiDocsDeleteUser,
} from './swagger/admin-users.swagger';

@ApiTags('Admin Users')
@Controller('admin/users')
@AdminApi()
export class AdminUsersController {
	constructor(private readonly adminUsersService: AdminUsersService) {}

	@Get('search')
	@ApiDocsSearch()
	search(@Query('q') query: string) {
		return this.adminUsersService.search(query);
	}

	@Get()
	@ApiDocsListUsers()
	listUsers(
		@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
		@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
		@Query('cursor') cursor?: string,
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
			cursor,
			search,
			role,
			isBanned,
			isSuspended,
		});
	}

	@Get(':userId')
	@ApiDocsGetUserById()
	getUserById(@Param('userId', ParseUUIDPipe) userId: string) {
		return this.adminUsersService.getUserById(userId);
	}

	@Patch(':userId')
	@ApiDocsUpdateUser()
	updateUser(
		@Param('userId', ParseUUIDPipe) userId: string,
		@Body() dto: AdminUpdateUserDto,
	) {
		return this.adminUsersService.updateUserByAdmin(userId, dto);
	}

	@Patch(':userId/roles')
	@ApiDocsUpdateUserRoles()
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

	@Patch(':userId/password')
	@ApiDocsChangePassword()
	changePassword(
		@Param('userId', ParseUUIDPipe) userId: string,
		@Body() dto: AdminChangePasswordDto,
	) {
		return this.adminUsersService.changeUserPassword(
			userId,
			dto.newPassword,
		);
	}

	@Patch(':userId/moderation')
	@ApiDocsSetModeration()
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
	@ApiDocsDeleteUser()
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
