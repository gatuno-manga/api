import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsDateString,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	Min,
} from 'class-validator';
import { AccessPolicyEffectEnum } from '../enum/access-policy-effect.enum';
import { AccessPolicyScopeEnum } from '../enum/access-policy-scope.enum';

export class CreateAccessPolicyDto {
	@IsEnum(AccessPolicyEffectEnum)
	@ApiProperty({ enum: AccessPolicyEffectEnum })
	effect: AccessPolicyEffectEnum;

	@IsEnum(AccessPolicyScopeEnum)
	@ApiProperty({ enum: AccessPolicyScopeEnum })
	scope: AccessPolicyScopeEnum;

	@IsOptional()
	@IsUUID('4')
	@ApiPropertyOptional()
	targetUserId?: string;

	@IsOptional()
	@IsUUID('4')
	@ApiPropertyOptional()
	targetGroupId?: string;

	@IsOptional()
	@IsUUID('4')
	@ApiPropertyOptional()
	bookId?: string;

	@IsOptional()
	@IsUUID('4')
	@ApiPropertyOptional()
	tagId?: string;

	@IsOptional()
	@IsUUID('4')
	@ApiPropertyOptional()
	sensitiveContentId?: string;

	@IsOptional()
	@IsBoolean()
	@ApiPropertyOptional({ default: true })
	isActive?: boolean;

	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(99)
	@ApiPropertyOptional({ example: 99 })
	overrideMaxWeightSensitiveContent?: number;

	@IsOptional()
	@IsDateString()
	@ApiPropertyOptional({ example: '2026-12-31T23:59:59.999Z' })
	expiresAt?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional({ example: 'Liberacao manual de moderacao' })
	reason?: string;
}
