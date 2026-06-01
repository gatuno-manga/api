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
import { AdminUsersService } from '@users/application/use-cases/admin-users.service';
import { PermissionsEnum } from '@users/domain/enums/permissions.enum';
import { AdminChangePasswordDto } from '@users/infrastructure/http/dto/admin-change-password.dto';
import { AdminUpdateUserDto } from '@users/infrastructure/http/dto/admin-update-user.dto';
import { SetUserModerationDto } from '@users/infrastructure/http/dto/set-user-moderation.dto';
import { UpdateUserRolesDto } from '@users/infrastructure/http/dto/update-user-roles.dto';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { Permissions } from 'src/auth/infrastructure/framework/permissions.decorator';
import { AdminApi } from 'src/common/swagger/auth-api.decorators';
import {
	ApiDocsChangePassword,
	ApiDocsDeleteUser,
	ApiDocsGetUserById,
	ApiDocsListUsers,
	ApiDocsSearch,
	ApiDocsSetModeration,
	ApiDocsUpdateUser,
	ApiDocsUpdateUserRoles,
} from './swagger/admin-users.swagger';

@ApiTags('Admin Users')
@Controller('admin/users')
@AdminApi()
export class AdminUsersController {
	constructor(private readonly adminUsersService: AdminUsersService) {}

	@Get('search')
	@Permissions(PermissionsEnum.USERS_SEARCH)
	@ApiDocsSearch()
	search(@Query('q') query: string) {
		return this.adminUsersService.search(query);
	}

	@Get()
	@Permissions(PermissionsEnum.USERS_VIEW)
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
	@Permissions(PermissionsEnum.USERS_VIEW)
	@ApiDocsGetUserById()
	getUserById(@Param('userId', ParseUUIDPipe) userId: string) {
		return this.adminUsersService.getUserById(userId);
	}

	@Patch(':userId')
	@Permissions(PermissionsEnum.USERS_EDIT)
	@ApiDocsUpdateUser()
	updateUser(
		@Param('userId', ParseUUIDPipe) userId: string,
		@Body() dto: AdminUpdateUserDto,
	) {
		return this.adminUsersService.updateUserByAdmin(userId, dto);
	}

	@Patch(':userId/roles')
	@Permissions(PermissionsEnum.USERS_ROLES_EDIT)
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
	@Permissions(PermissionsEnum.USERS_PASSWORD_EDIT)
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
	@Permissions(PermissionsEnum.USERS_MODERATION)
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
	@Permissions(PermissionsEnum.USERS_DELETE)
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
