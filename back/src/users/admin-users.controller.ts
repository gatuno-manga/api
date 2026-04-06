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
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { AdminApi } from 'src/common/swagger/auth-api.decorators';
import { COMMON_RESPONSES } from 'src/common/swagger/common-responses';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { SetUserModerationDto } from './dto/set-user-moderation.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { AdminUsersService } from './admin-users.service';

@ApiTags('Admin Users')
@Controller('admin/users')
@AdminApi()
export class AdminUsersController {
	constructor(private readonly adminUsersService: AdminUsersService) {}

	@Get()
	@ApiOperation({ summary: 'Listar usuarios com filtros administrativos' })
	@ApiResponse({ status: 200, description: 'Usuarios listados com sucesso' })
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN)
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
	@ApiOperation({ summary: 'Buscar usuario por id (admin)' })
	@ApiResponse({ status: 200, description: 'Usuario retornado com sucesso' })
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN)
	getUserById(@Param('userId', ParseUUIDPipe) userId: string) {
		return this.adminUsersService.getUserById(userId);
	}

	@Patch(':userId')
	@ApiOperation({
		summary: 'Atualizar configuracoes de perfil do usuario (admin)',
	})
	@ApiResponse({ status: 200, description: 'Usuario atualizado com sucesso' })
	@ApiResponse(COMMON_RESPONSES.BAD_REQUEST)
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN)
	updateUser(
		@Param('userId', ParseUUIDPipe) userId: string,
		@Body() dto: AdminUpdateUserDto,
	) {
		return this.adminUsersService.updateUserByAdmin(userId, dto);
	}

	@Patch(':userId/roles')
	@ApiOperation({ summary: 'Substituir roles de um usuario (admin)' })
	@ApiResponse({ status: 200, description: 'Roles atualizadas com sucesso' })
	@ApiResponse(COMMON_RESPONSES.BAD_REQUEST)
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN)
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
	@ApiOperation({ summary: 'Aplicar banimento/suspensao ao usuario' })
	@ApiResponse({ status: 200, description: 'Moderacao aplicada com sucesso' })
	@ApiResponse(COMMON_RESPONSES.BAD_REQUEST)
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN)
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
	@ApiOperation({ summary: 'Excluir conta de usuario (admin)' })
	@ApiResponse({ status: 200, description: 'Usuario excluido com sucesso' })
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN)
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
