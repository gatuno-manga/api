import { AccessPolicyEffectEnum } from '@users/domain/enums/access-policy-effect.enum';
import { AccessPolicyScopeEnum } from '@users/domain/enums/access-policy-scope.enum';
import { Type } from 'class-transformer';
import {
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	Min,
} from 'class-validator';

export class ListAccessPoliciesQueryDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number = 1;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number = 20;

	@IsOptional()
	@IsString()
	search?: string;

	@IsOptional()
	@IsEnum(AccessPolicyEffectEnum)
	effect?: AccessPolicyEffectEnum;

	@IsOptional()
	@IsEnum(AccessPolicyScopeEnum)
	scope?: AccessPolicyScopeEnum;

	@IsOptional()
	@IsUUID()
	targetUserId?: string;

	@IsOptional()
	@IsUUID()
	targetGroupId?: string;

	@IsOptional()
	@IsString()
	isActive?: string;
}
