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
import { ApiTags } from '@nestjs/swagger';
import { AdminUsersService } from '@users/application/use-cases/admin-users.service';
import { PermissionsEnum } from '@users/domain/enums/permissions.enum';
import { CreateGroupDto } from '@users/infrastructure/http/dto/create-group.dto';
import { UpdateGroupMembersDto } from '@users/infrastructure/http/dto/update-group-members.dto';
import { UpdateGroupDto } from '@users/infrastructure/http/dto/update-group.dto';
import { AdminApi } from 'src/common/swagger/auth-api.decorators';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import {
	ApiDocsAddMembers,
	ApiDocsCreateGroup,
	ApiDocsDeleteGroup,
	ApiDocsListGroups,
	ApiDocsRemoveMember,
	ApiDocsUpdateGroup,
} from './swagger/admin-groups.swagger';

@ApiTags('Admin Groups')
@Controller('admin/groups')
@AdminApi()
export class AdminGroupsController {
	constructor(private readonly adminUsersService: AdminUsersService) {}

	@Get()
	@Permissions(PermissionsEnum.GROUPS_VIEW)
	@ApiDocsListGroups()
	listGroups() {
		return this.adminUsersService.listGroups();
	}

	@Post()
	@Permissions(PermissionsEnum.GROUPS_MANAGE)
	@ApiDocsCreateGroup()
	createGroup(@Body() dto: CreateGroupDto) {
		return this.adminUsersService.createGroup(dto);
	}

	@Patch(':groupId')
	@Permissions(PermissionsEnum.GROUPS_MANAGE)
	@ApiDocsUpdateGroup()
	updateGroup(
		@Param('groupId', ParseUUIDPipe) groupId: string,
		@Body() dto: UpdateGroupDto,
	) {
		return this.adminUsersService.updateGroup(groupId, dto);
	}

	@Delete(':groupId')
	@Permissions(PermissionsEnum.GROUPS_MANAGE)
	@ApiDocsDeleteGroup()
	deleteGroup(@Param('groupId', ParseUUIDPipe) groupId: string) {
		return this.adminUsersService.deleteGroup(groupId);
	}

	@Post(':groupId/members')
	@Permissions(PermissionsEnum.GROUPS_MANAGE)
	@ApiDocsAddMembers()
	addMembers(
		@Param('groupId', ParseUUIDPipe) groupId: string,
		@Body() dto: UpdateGroupMembersDto,
	) {
		return this.adminUsersService.addMembersToGroup(groupId, dto.userIds);
	}

	@Delete(':groupId/members/:userId')
	@Permissions(PermissionsEnum.GROUPS_MANAGE)
	@ApiDocsRemoveMember()
	removeMember(
		@Param('groupId', ParseUUIDPipe) groupId: string,
		@Param('userId', ParseUUIDPipe) userId: string,
	) {
		return this.adminUsersService.removeMemberFromGroup(groupId, userId);
	}
}
