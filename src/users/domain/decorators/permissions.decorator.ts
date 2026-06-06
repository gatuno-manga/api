import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: (PermissionsEnum | string)[]) =>
	applyDecorators(
		SetMetadata(PERMISSIONS_KEY, permissions),
		ApiExtension('x-permissions', permissions),
	);
