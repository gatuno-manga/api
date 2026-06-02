import { UseGuards, applyDecorators } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import { SWAGGER_AUTH_SCHEME } from './swagger-auth.constants';

export function AuthenticatedApi() {
	return applyDecorators(
		UseGuards(JwtAuthGuard, PermissionsGuard),
		ApiBearerAuth(SWAGGER_AUTH_SCHEME),
	);
}

export function AdminApi() {
	return applyDecorators(
		UseGuards(JwtAuthGuard, PermissionsGuard),
		Roles(RolesEnum.ADMIN),
		ApiBearerAuth(SWAGGER_AUTH_SCHEME),
	);
}
