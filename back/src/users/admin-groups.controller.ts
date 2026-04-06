import {
	Body,
	Controller,
	Delete,
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
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupMembersDto } from './dto/update-group-members.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@ApiTags('Admin Groups')
@Controller('admin/groups')
@AdminApi()
export class AdminGroupsController {
	constructor(private readonly adminUsersService: AdminUsersService) {}

	@Get()
	@ApiOperation({ summary: 'Listar todos os grupos' })
	@ApiResponse({ status: 200, description: 'Grupos listados com sucesso' })
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN)
	listGroups() {
		return this.adminUsersService.listGroups();
	}

	@Post()
	@ApiOperation({ summary: 'Criar grupo' })
	@ApiResponse({ status: 201, description: 'Grupo criado com sucesso' })
	@ApiResponse(COMMON_RESPONSES.BAD_REQUEST)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN)
	createGroup(@Body() dto: CreateGroupDto) {
		return this.adminUsersService.createGroup(dto);
	}

	@Patch(':groupId')
	@ApiOperation({ summary: 'Atualizar grupo' })
	@ApiResponse({ status: 200, description: 'Grupo atualizado com sucesso' })
	@ApiResponse(COMMON_RESPONSES.BAD_REQUEST)
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN)
	updateGroup(
		@Param('groupId', ParseUUIDPipe) groupId: string,
		@Body() dto: UpdateGroupDto,
	) {
		return this.adminUsersService.updateGroup(groupId, dto);
	}

	@Delete(':groupId')
	@ApiOperation({ summary: 'Excluir grupo' })
	@ApiResponse({ status: 200, description: 'Grupo excluido com sucesso' })
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN)
	deleteGroup(@Param('groupId', ParseUUIDPipe) groupId: string) {
		return this.adminUsersService.deleteGroup(groupId);
	}

	@Post(':groupId/members')
	@ApiOperation({ summary: 'Adicionar membros ao grupo' })
	@ApiResponse({
		status: 201,
		description: 'Membros adicionados com sucesso',
	})
	@ApiResponse(COMMON_RESPONSES.BAD_REQUEST)
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN)
	addMembers(
		@Param('groupId', ParseUUIDPipe) groupId: string,
		@Body() dto: UpdateGroupMembersDto,
	) {
		return this.adminUsersService.addMembersToGroup(groupId, dto.userIds);
	}

	@Delete(':groupId/members/:userId')
	@ApiOperation({ summary: 'Remover membro do grupo' })
	@ApiResponse({ status: 200, description: 'Membro removido com sucesso' })
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN)
	removeMember(
		@Param('groupId', ParseUUIDPipe) groupId: string,
		@Param('userId', ParseUUIDPipe) userId: string,
	) {
		return this.adminUsersService.removeMemberFromGroup(groupId, userId);
	}
}
