import {
	Body,
	Controller,
	Delete,
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
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupMembersDto } from './dto/update-group-members.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { RolesEnum } from './enum/roles.enum';

@ApiTags('Admin Groups')
@Controller('admin/groups')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminGroupsController {
	constructor(private readonly adminUsersService: AdminUsersService) {}

	@Get()
	@ApiOperation({ summary: 'List all groups' })
	listGroups() {
		return this.adminUsersService.listGroups();
	}

	@Post()
	@ApiOperation({ summary: 'Create group' })
	createGroup(@Body() dto: CreateGroupDto) {
		return this.adminUsersService.createGroup(dto);
	}

	@Patch(':groupId')
	@ApiOperation({ summary: 'Update group' })
	updateGroup(
		@Param('groupId', ParseUUIDPipe) groupId: string,
		@Body() dto: UpdateGroupDto,
	) {
		return this.adminUsersService.updateGroup(groupId, dto);
	}

	@Delete(':groupId')
	@ApiOperation({ summary: 'Delete group' })
	deleteGroup(@Param('groupId', ParseUUIDPipe) groupId: string) {
		return this.adminUsersService.deleteGroup(groupId);
	}

	@Post(':groupId/members')
	@ApiOperation({ summary: 'Add members to group' })
	addMembers(
		@Param('groupId', ParseUUIDPipe) groupId: string,
		@Body() dto: UpdateGroupMembersDto,
	) {
		return this.adminUsersService.addMembersToGroup(groupId, dto.userIds);
	}

	@Delete(':groupId/members/:userId')
	@ApiOperation({ summary: 'Remove member from group' })
	removeMember(
		@Param('groupId', ParseUUIDPipe) groupId: string,
		@Param('userId', ParseUUIDPipe) userId: string,
	) {
		return this.adminUsersService.removeMemberFromGroup(groupId, userId);
	}
}
