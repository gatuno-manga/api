import {
	Body,
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminUsersService } from '@users/application/use-cases/admin-users.service';
import { PermissionsEnum } from '@users/domain/enums/permissions.enum';
import { CreateRoleDto } from '@users/infrastructure/http/dto/create-role.dto';
import { UpdateRoleDto } from '@users/infrastructure/http/dto/update-role.dto';
import { AdminApi } from 'src/common/swagger/auth-api.decorators';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import {
	ApiDocsCreateRole,
	ApiDocsListRoles,
	ApiDocsUpdateRole,
} from './swagger/admin-roles.swagger';

@ApiTags('Admin Roles')
@Controller('admin/roles')
@AdminApi()
export class AdminRolesController {
	constructor(private readonly adminUsersService: AdminUsersService) {}

	@Get()
	@Permissions(PermissionsEnum.ROLES_VIEW)
	@ApiDocsListRoles()
	listRoles() {
		return this.adminUsersService.listRoles();
	}

	@Post()
	@Permissions(PermissionsEnum.ROLES_MANAGE)
	@ApiDocsCreateRole()
	createRole(@Body() dto: CreateRoleDto) {
		return this.adminUsersService.createRole(dto);
	}

	@Patch(':roleId')
	@Permissions(PermissionsEnum.ROLES_MANAGE)
	@ApiDocsUpdateRole()
	updateRole(
		@Param('roleId', ParseUUIDPipe) roleId: string,
		@Body() dto: UpdateRoleDto,
	) {
		return this.adminUsersService.updateRole(roleId, dto);
	}
}
