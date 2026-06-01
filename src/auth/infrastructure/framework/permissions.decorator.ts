import { SetMetadata } from '@nestjs/common';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: (PermissionsEnum | string)[]) =>
	SetMetadata(PERMISSIONS_KEY, permissions);
