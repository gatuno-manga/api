import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import { Permission } from 'src/users/infrastructure/database/entities/permission.entity';
import { Role } from 'src/users/infrastructure/database/entities/role.entity';
import { Repository } from 'typeorm';

@Injectable()
export class RbacSeederService {
	private readonly logger = new Logger(RbacSeederService.name);

	constructor(
		@InjectRepository(Role)
		private readonly roleRepository: Repository<Role>,
		@InjectRepository(Permission)
		private readonly permissionRepository: Repository<Permission>,
	) {}

	@OnEvent('app.ready')
	async seed() {
		try {
			this.logger.log('Starting RBAC seeding...');

			const allPermissions = await this.seedPermissions();
			await this.seedRoles(allPermissions);

			this.logger.log('RBAC seeding completed successfully.');
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			this.logger.error(`Error during RBAC seeding: ${errorMessage}`);
		}
	}

	private async seedPermissions(): Promise<Permission[]> {
		const permissionNames = Object.values(PermissionsEnum);
		const existingPermissions = await this.permissionRepository.find();
		const existingNames = new Set(existingPermissions.map((p) => p.name));

		const permissionsToCreate = permissionNames
			.filter((name) => !existingNames.has(name))
			.map((name) => {
				const p = new Permission();
				p.name = name;
				p.description = `Permission for ${name}`;
				return p;
			});

		if (permissionsToCreate.length > 0) {
			await this.permissionRepository.save(permissionsToCreate);
			this.logger.log(
				`Created ${permissionsToCreate.length} new permissions.`,
			);
		}

		return this.permissionRepository.find();
	}

	private async seedRoles(allPermissions: Permission[]): Promise<void> {
		const rolesToSeed = [
			{
				name: RolesEnum.ADMIN,
				maxWeight: 99,
				permissionFilter: () => true, // All permissions
			},
			{
				name: RolesEnum.USER,
				maxWeight: 0,
				permissionFilter: (p: string) => !p.startsWith('admin:'), // No admin permissions
			},
			{
				name: RolesEnum.GUEST,
				maxWeight: 0,
				permissionFilter: (p: string) =>
					[
						PermissionsEnum.BOOKS_VIEW,
						PermissionsEnum.AUTHORS_VIEW,
						PermissionsEnum.TAGS_VIEW,
						PermissionsEnum.CHAPTERS_VIEW,
						PermissionsEnum.CHAPTER_COMMENTS_VIEW,
						PermissionsEnum.WEBSITES_VIEW,
					].includes(p as PermissionsEnum),
			},
		];

		for (const roleData of rolesToSeed) {
			let role = await this.roleRepository.findOne({
				where: { name: roleData.name },
				relations: ['permissions'],
			});

			if (!role) {
				role = new Role();
				role.name = roleData.name;
				role.maxWeightSensitiveContent = roleData.maxWeight;
			}

			role.permissions = allPermissions.filter((p) =>
				roleData.permissionFilter(p.name),
			);

			await this.roleRepository.save(role);
			this.logger.debug(`Synchronized role: ${role.name}`);
		}
	}
}
