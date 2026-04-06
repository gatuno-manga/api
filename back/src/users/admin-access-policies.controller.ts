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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { AdminApi } from 'src/common/swagger/auth-api.decorators';
import { COMMON_RESPONSES } from 'src/common/swagger/common-responses';
import { AdminUsersService } from './admin-users.service';
import { CreateAccessPolicyDto } from './dto/create-access-policy.dto';
import { ListAccessPoliciesQueryDto } from './dto/list-access-policies-query.dto';

@ApiTags('Admin Access Policies')
@Controller('admin/access-policies')
@AdminApi()
export class AdminAccessPoliciesController {
	constructor(private readonly adminUsersService: AdminUsersService) {}

	@Get()
	@ApiOperation({ summary: 'Listar politicas de acesso' })
	@ApiResponse({ status: 200, description: 'Politicas listadas com sucesso' })
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN)
	listPolicies(@Query() query: ListAccessPoliciesQueryDto) {
		return this.adminUsersService.listAccessPolicies(query);
	}

	@Post()
	@ApiOperation({ summary: 'Criar politica de acesso' })
	@ApiResponse({ status: 201, description: 'Politica criada com sucesso' })
	@ApiResponse(COMMON_RESPONSES.BAD_REQUEST)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN)
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
	@ApiOperation({ summary: 'Excluir politica de acesso' })
	@ApiResponse({ status: 200, description: 'Politica excluida com sucesso' })
	@ApiResponse(COMMON_RESPONSES.NOT_FOUND)
	@ApiResponse(COMMON_RESPONSES.UNAUTHORIZED)
	@ApiResponse(COMMON_RESPONSES.FORBIDDEN_ADMIN)
	deletePolicy(@Param('policyId', ParseUUIDPipe) policyId: string) {
		return this.adminUsersService.deleteAccessPolicy(policyId);
	}
}
