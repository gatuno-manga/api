import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AccessPolicyEffectEnum } from '../enum/access-policy-effect.enum';
import { AccessPolicyScopeEnum } from '../enum/access-policy-scope.enum';

export class ListAccessPoliciesQueryDto {
	@IsOptional()
	@IsEnum(AccessPolicyEffectEnum)
	@ApiPropertyOptional({ enum: AccessPolicyEffectEnum })
	effect?: AccessPolicyEffectEnum;

	@IsOptional()
	@IsEnum(AccessPolicyScopeEnum)
	@ApiPropertyOptional({ enum: AccessPolicyScopeEnum })
	scope?: AccessPolicyScopeEnum;

	@IsOptional()
	@IsUUID('4')
	@ApiPropertyOptional()
	targetUserId?: string;

	@IsOptional()
	@IsUUID('4')
	@ApiPropertyOptional()
	targetGroupId?: string;

	@IsOptional()
	@IsBooleanString()
	@ApiPropertyOptional({ example: 'true' })
	isActive?: string;
}
