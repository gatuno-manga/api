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
import { AdminApi } from 'src/common/swagger/auth-api.decorators';
import { AdminUsersService } from '../../application/use-cases/admin-users.service';
import { CreateRoleDto } from '../http/dto/create-role.dto';
import { UpdateRoleDto } from '../http/dto/update-role.dto';
import {
	ApiDocsListRoles,
	ApiDocsCreateRole,
	ApiDocsUpdateRole,
} from './swagger/admin-roles.swagger';

@ApiTags('Admin Roles')
@Controller('admin/roles')
@AdminApi()
export class AdminRolesController {
	constructor(private readonly adminUsersService: AdminUsersService) {}

	@Get()
	@ApiDocsListRoles()
	listRoles() {
		return this.adminUsersService.listRoles();
	}

	@Post()
	@ApiDocsCreateRole()
	createRole(@Body() dto: CreateRoleDto) {
		return this.adminUsersService.createRole(dto);
	}

	@Patch(':roleId')
	@ApiDocsUpdateRole()
	updateRole(
		@Param('roleId', ParseUUIDPipe) roleId: string,
		@Body() dto: UpdateRoleDto,
	) {
		return this.adminUsersService.updateRole(roleId, dto);
	}
}
