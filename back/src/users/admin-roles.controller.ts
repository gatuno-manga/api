import {
	Body,
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminApi } from 'src/common/swagger/auth-api.decorators';
import { COMMON_RESPONSES } from 'src/common/swagger/common-responses';
import { AdminUsersService } from './admin-users.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@ApiTags('Admin Roles')
@Controller('admin/roles')
@AdminApi()
export class AdminRolesController {
	constructor(private readonly adminUsersService: AdminUsersService) {}

	@Get()
	@ApiOperation({ summary: 'Listar todas as roles' })
	@ApiResponse({ status: 200, description: 'Roles listadas com sucesso' })
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN)
	listRoles() {
		return this.adminUsersService.listRoles();
	}

	@Post()
	@ApiOperation({ summary: 'Criar role' })
	@ApiResponse({ status: 201, description: 'Role criada com sucesso' })
	@ApiResponse(COMMON_RESPONSES.BAD_REQUEST)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN)
	createRole(@Body() dto: CreateRoleDto) {
		return this.adminUsersService.createRole(dto);
	}

	@Patch(':roleId')
	@ApiOperation({ summary: 'Atualizar role' })
	@ApiResponse({ status: 200, description: 'Role atualizada com sucesso' })
	@ApiResponse(COMMON_RESPONSES.BAD_REQUEST)
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN)
	updateRole(
		@Param('roleId', ParseUUIDPipe) roleId: string,
		@Body() dto: UpdateRoleDto,
	) {
		return this.adminUsersService.updateRole(roleId, dto);
	}
}
