import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminUsersService } from '@users/application/use-cases/admin-users.service';
import { PermissionsEnum } from '@users/domain/enums/permissions.enum';
import { CreateAccessPolicyDto } from '@users/infrastructure/http/dto/create-access-policy.dto';
import { ListAccessPoliciesQueryDto } from '@users/infrastructure/http/dto/list-access-policies-query.dto';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { AdminApi } from 'src/common/swagger/auth-api.decorators';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import {
	ApiDocsCreatePolicy,
	ApiDocsDeletePolicy,
	ApiDocsListPolicies,
} from './swagger/admin-access-policies.swagger';

@ApiTags('Admin Access Policies')
@Controller('admin/access-policies')
@AdminApi()
export class AdminAccessPoliciesController {
	constructor(private readonly adminUsersService: AdminUsersService) {}

	@Get()
	@Permissions(PermissionsEnum.ACCESS_POLICIES_VIEW)
	@ApiDocsListPolicies()
	listPolicies(@Query() query: ListAccessPoliciesQueryDto) {
		return this.adminUsersService.listAccessPolicies(query);
	}

	@Post()
	@Permissions(PermissionsEnum.ACCESS_POLICIES_MANAGE)
	@ApiDocsCreatePolicy()
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
	@Permissions(PermissionsEnum.ACCESS_POLICIES_MANAGE)
	@ApiDocsDeletePolicy()
	deletePolicy(@Param('policyId', ParseUUIDPipe) policyId: string) {
		return this.adminUsersService.deleteAccessPolicy(policyId);
	}
}
