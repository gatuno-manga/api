import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { AdminUsersService } from './admin-users.service';
import { CreateAccessPolicyDto } from './dto/create-access-policy.dto';
import { ListAccessPoliciesQueryDto } from './dto/list-access-policies-query.dto';
import { RolesEnum } from './enum/roles.enum';

@ApiTags('Admin Access Policies')
@Controller('admin/access-policies')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminAccessPoliciesController {
	constructor(private readonly adminUsersService: AdminUsersService) {}

	@Get()
	@ApiOperation({ summary: 'List access policies' })
	listPolicies(@Query() query: ListAccessPoliciesQueryDto) {
		return this.adminUsersService.listAccessPolicies(query);
	}

	@Post()
	@ApiOperation({ summary: 'Create access policy' })
	createPolicy(
		@Body() dto: CreateAccessPolicyDto,
		@CurrentUser() currentUser: CurrentUserDto,
	) {
		return this.adminUsersService.createAccessPolicy(
			dto,
			currentUser.userId,
		);
	}

	@Delete(':policyId')
	@ApiOperation({ summary: 'Delete access policy' })
	deletePolicy(@Param('policyId', ParseUUIDPipe) policyId: string) {
		return this.adminUsersService.deleteAccessPolicy(policyId);
	}
}
