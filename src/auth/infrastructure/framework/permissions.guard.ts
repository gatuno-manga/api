import { CurrentUserDto } from '@auth/application/dto/current-user.dto';
import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserPermissionsService } from 'src/users/application/services/user-permissions.service';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly userPermissionsService: UserPermissionsService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
			PERMISSIONS_KEY,
			[context.getHandler(), context.getClass()],
		);

		if (!requiredPermissions || requiredPermissions.length === 0) {
			return true;
		}

		const request = context.switchToHttp().getRequest();
		const user = request.user as CurrentUserDto;

		if (!user || !user.userId) {
			return false;
		}

		// Use UserPermissionsService which implements caching
		const userPermissions =
			await this.userPermissionsService.getPermissions(user.userId);

		const hasPermission = requiredPermissions.every((permission) =>
			userPermissions.includes(permission),
		);

		if (!hasPermission) {
			throw new ForbiddenException('Insufficient permissions');
		}

		return true;
	}
}
