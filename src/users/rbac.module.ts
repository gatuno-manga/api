import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionsGuard } from './application/services/permissions.guard';
import { UserPermissionsService } from './application/services/user-permissions.service';
import { Permission } from './infrastructure/database/entities/permission.entity';
import { Role } from './infrastructure/database/entities/role.entity';
import { User } from './infrastructure/database/entities/user.entity';

@Module({
	imports: [TypeOrmModule.forFeature([User, Role, Permission])],
	providers: [UserPermissionsService, PermissionsGuard],
	exports: [UserPermissionsService, PermissionsGuard],
})
export class RbacModule {}
