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
import { AdminApi } from 'src/common/swagger/auth-api.decorators';
import { AdminUsersService } from '../../application/use-cases/admin-users.service';
import { CreateGroupDto } from '../http/dto/create-group.dto';
import { UpdateGroupMembersDto } from '../http/dto/update-group-members.dto';
import { UpdateGroupDto } from '../http/dto/update-group.dto';
import {
	ApiDocsListGroups,
	ApiDocsCreateGroup,
	ApiDocsUpdateGroup,
	ApiDocsDeleteGroup,
	ApiDocsAddMembers,
	ApiDocsRemoveMember,
} from './swagger/admin-groups.swagger';

@ApiTags('Admin Groups')
@Controller('admin/groups')
@AdminApi()
export class AdminGroupsController {
	constructor(private readonly adminUsersService: AdminUsersService) {}

	@Get()
	@ApiDocsListGroups()
	listGroups() {
		return this.adminUsersService.listGroups();
	}

	@Post()
	@ApiDocsCreateGroup()
	createGroup(@Body() dto: CreateGroupDto) {
		return this.adminUsersService.createGroup(dto);
	}

	@Patch(':groupId')
	@ApiDocsUpdateGroup()
	updateGroup(
		@Param('groupId', ParseUUIDPipe) groupId: string,
		@Body() dto: UpdateGroupDto,
	) {
		return this.adminUsersService.updateGroup(groupId, dto);
	}

	@Delete(':groupId')
	@ApiDocsDeleteGroup()
	deleteGroup(@Param('groupId', ParseUUIDPipe) groupId: string) {
		return this.adminUsersService.deleteGroup(groupId);
	}

	@Post(':groupId/members')
	@ApiDocsAddMembers()
	addMembers(
		@Param('groupId', ParseUUIDPipe) groupId: string,
		@Body() dto: UpdateGroupMembersDto,
	) {
		return this.adminUsersService.addMembersToGroup(groupId, dto.userIds);
	}

	@Delete(':groupId/members/:userId')
	@ApiDocsRemoveMember()
	removeMember(
		@Param('groupId', ParseUUIDPipe) groupId: string,
		@Param('userId', ParseUUIDPipe) userId: string,
	) {
		return this.adminUsersService.removeMemberFromGroup(groupId, userId);
	}
}
