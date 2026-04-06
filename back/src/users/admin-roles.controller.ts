import {
	Body,
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { AdminUsersService } from './admin-users.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesEnum } from './enum/roles.enum';

@ApiTags('Admin Roles')
@Controller('admin/roles')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminRolesController {
	constructor(private readonly adminUsersService: AdminUsersService) {}

	@Get()
	@ApiOperation({ summary: 'List all roles' })
	listRoles() {
		return this.adminUsersService.listRoles();
	}

	@Post()
	@ApiOperation({ summary: 'Create role' })
	createRole(@Body() dto: CreateRoleDto) {
		return this.adminUsersService.createRole(dto);
	}

	@Patch(':roleId')
	@ApiOperation({ summary: 'Update role' })
	updateRole(
		@Param('roleId', ParseUUIDPipe) roleId: string,
		@Body() dto: UpdateRoleDto,
	) {
		return this.adminUsersService.updateRole(roleId, dto);
	}
}
