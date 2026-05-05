import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AccessPolicyEffectEnum } from '@users/domain/enums/access-policy-effect.enum';
import { AccessPolicyScopeEnum } from '@users/domain/enums/access-policy-scope.enum';

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
	@IsUUID('all')
	@ApiPropertyOptional()
	targetUserId?: string;

	@IsOptional()
	@IsUUID('all')
	@ApiPropertyOptional()
	targetGroupId?: string;

	@IsOptional()
	@IsBooleanString()
	@ApiPropertyOptional({ example: 'true' })
	isActive?: string;
}
