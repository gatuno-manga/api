import { MEILI_CLIENT } from '@/infrastructure/meilisearch/meilisearch.constants';
import { PasswordEncryption } from '@encryption/password-encryption.provider';
import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { UserPermissionsService } from '@users/application/services/user-permissions.service';
import { AccessPolicyEffectEnum } from '@users/domain/enums/access-policy-effect.enum';
import { AccessPolicyScopeEnum } from '@users/domain/enums/access-policy-scope.enum';
import { RolesEnum } from '@users/domain/enums/roles.enum';
import { AccessPolicy } from '@users/infrastructure/database/entities/access-policy.entity';
import { Permission } from '@users/infrastructure/database/entities/permission.entity';
import { Role } from '@users/infrastructure/database/entities/role.entity';
import { UserGroup } from '@users/infrastructure/database/entities/user-group.entity';
import { User } from '@users/infrastructure/database/entities/user.entity';
import { CreateAccessPolicyDto } from '@users/infrastructure/http/dto/create-access-policy.dto';
import { CreateGroupDto } from '@users/infrastructure/http/dto/create-group.dto';
import { CreateRoleDto } from '@users/infrastructure/http/dto/create-role.dto';
import { ListAccessPoliciesQueryDto } from '@users/infrastructure/http/dto/list-access-policies-query.dto';
import { SetUserModerationDto } from '@users/infrastructure/http/dto/set-user-moderation.dto';
import { UpdateGroupDto } from '@users/infrastructure/http/dto/update-group.dto';
import { UpdateRoleDto } from '@users/infrastructure/http/dto/update-role.dto';
import { UpdateUserRolesDto } from '@users/infrastructure/http/dto/update-user-roles.dto';
import { WebPushService } from '@users/infrastructure/web-push/web-push.service';
import { Meilisearch } from 'meilisearch';
import { CursorPageDto } from 'src/common/pagination/cursor-page.dto';
import {
	decodeCursorPayload,
	encodeCursorPayload,
} from 'src/common/pagination/cursor.utils';
import { Brackets, In, Repository } from 'typeorm';

type AdminUsersCursorPayload = {
	createdAt: string;
	id: string;
};

@Injectable()
export class AdminUsersService {
	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(Role)
		private readonly roleRepository: Repository<Role>,
		@InjectRepository(UserGroup)
		private readonly groupRepository: Repository<UserGroup>,
		@InjectRepository(AccessPolicy)
		private readonly accessPolicyRepository: Repository<AccessPolicy>,
		@InjectRepository(Permission)
		private readonly permissionRepository: Repository<Permission>,
		@Inject(MEILI_CLIENT) private readonly meiliClient: Meilisearch,
		private readonly passwordEncryption: PasswordEncryption,
		private readonly userPermissionsService: UserPermissionsService,
		@Inject('MQTT_CLIENT') private readonly mqttClient: ClientProxy,
		private readonly webPushService: WebPushService,
	) {}

	async search(query: string) {
		try {
			const result = await this.meiliClient.index('users').search(query, {
				limit: 20,
			});
			return result.hits;
		} catch (_error) {
			return [];
		}
	}

	async listUsers(params: {
		page: number;
		limit: number;
		cursor?: string;
		search?: string;
		role?: string;
		isBanned?: boolean;
		isSuspended?: boolean;
	}) {
		const page = Math.max(1, params.page);
		const limit = Math.min(100, Math.max(1, params.limit));

		const qb = this.userRepository
			.createQueryBuilder('user')
			.leftJoinAndSelect('user.roles', 'role')
			.leftJoinAndSelect('user.groups', 'group');

		if (params.search) {
			qb.andWhere(
				new Brackets((query) => {
					query
						.where('user.userName LIKE :search', {
							search: `%${params.search}%`,
						})
						.orWhere('user.name LIKE :search', {
							search: `%${params.search}%`,
						})
						.orWhere('user.email LIKE :search', {
							search: `%${params.search}%`,
						});
				}),
			);
		}

		if (params.role) {
			qb.andWhere('role.name = :role', { role: params.role });
		}

		if (typeof params.isBanned === 'boolean') {
			qb.andWhere('user.isBanned = :isBanned', {
				isBanned: params.isBanned,
			});
		}

		if (typeof params.isSuspended === 'boolean') {
			const now = new Date();
			if (params.isSuspended) {
				qb.andWhere(
					'user.suspendedUntil IS NOT NULL AND user.suspendedUntil > :now',
					{
						now,
					},
				);
			} else {
				qb.andWhere(
					'(user.suspendedUntil IS NULL OR user.suspendedUntil <= :now)',
					{
						now,
					},
				);
			}
		}

		qb.orderBy('user.createdAt', 'DESC').addOrderBy('user.id', 'DESC');

		if (params.cursor) {
			const decodedCursor = decodeCursorPayload<AdminUsersCursorPayload>(
				params.cursor,
			);
			if (
				decodedCursor &&
				typeof decodedCursor.createdAt === 'string' &&
				typeof decodedCursor.id === 'string'
			) {
				const parsedDate = new Date(decodedCursor.createdAt);
				if (!Number.isNaN(parsedDate.getTime())) {
					qb.andWhere(
						`(
							user.createdAt < :cursorCreatedAt
							OR (user.createdAt = :cursorCreatedAt AND user.id < :cursorId)
						)`,
						{
							cursorCreatedAt: parsedDate,
							cursorId: decodedCursor.id,
						},
					);
				}
			}

			qb.take(limit + 1);
			const users = await qb.getMany();
			const hasNextPage = users.length > limit;
			const data = hasNextPage ? users.slice(0, limit) : users;
			const lastUser = data[data.length - 1];
			const nextCursor =
				hasNextPage && lastUser
					? encodeCursorPayload({
							createdAt: lastUser.createdAt.toISOString(),
							id: lastUser.id,
						})
					: null;

			return new CursorPageDto(data, nextCursor, hasNextPage);
		}

		qb.skip((page - 1) * limit).take(limit);

		const [users, total] = await qb.getManyAndCount();
		return {
			data: users,
			meta: {
				total,
				page,
				limit,
				lastPage: Math.ceil(total / limit),
			},
		};
	}

	async getUserById(userId: string) {
		const user = await this.userRepository.findOne({
			where: { id: userId },
			relations: ['roles', 'groups'],
		});
		if (!user) {
			throw new NotFoundException(`User with id ${userId} not found`);
		}
		return user;
	}

	async updateUserByAdmin(
		userId: string,
		dto: {
			userName?: string;
			name?: string;
			maxWeightSensitiveContent?: number;
			isBanned?: boolean;
			suspendedUntil?: string;
			suspensionReason?: string;
		},
	) {
		const user = await this.getUserById(userId);
		if (dto.userName !== undefined) {
			user.userName = dto.userName;
		}
		if (dto.name !== undefined) {
			user.name = dto.name;
		}
		if (dto.maxWeightSensitiveContent !== undefined) {
			user.maxWeightSensitiveContent = dto.maxWeightSensitiveContent;
		}
		if (dto.isBanned !== undefined) {
			user.isBanned = dto.isBanned;
		}
		if (dto.suspendedUntil !== undefined) {
			user.suspendedUntil = dto.suspendedUntil
				? new Date(dto.suspendedUntil)
				: null;
		}
		if (dto.suspensionReason !== undefined) {
			user.suspensionReason = dto.suspensionReason;
		}
		return this.userRepository.save(user);
	}

	async updateUserRoles(
		targetUserId: string,
		dto: UpdateUserRolesDto,
		currentAdminId: string,
	) {
		const user = await this.getUserById(targetUserId);
		const roles = await this.roleRepository.find({
			where: { name: In(dto.roles) },
		});

		if (roles.length !== dto.roles.length) {
			throw new BadRequestException('One or more roles were not found');
		}

		if (
			targetUserId === currentAdminId &&
			!roles.some((role) => role.name === (RolesEnum.ADMIN as string))
		) {
			throw new BadRequestException(
				'You cannot remove your own admin role',
			);
		}

		user.roles = roles;
		const savedUser = await this.userRepository.save(user);

		// Invalidate permissions cache
		await this.userPermissionsService.invalidateCache(targetUserId);

		return savedUser;
	}

	async setUserModeration(
		targetUserId: string,
		dto: SetUserModerationDto,
		currentAdminId: string,
	) {
		if (targetUserId === currentAdminId && dto.isBanned === true) {
			throw new BadRequestException('You cannot ban yourself');
		}

		const user = await this.getUserById(targetUserId);
		if (dto.isBanned !== undefined) {
			user.isBanned = dto.isBanned;
		}

		if (dto.suspendedUntil !== undefined) {
			if (!dto.suspendedUntil) {
				user.suspendedUntil = null;
			} else {
				const suspendedUntil = new Date(dto.suspendedUntil);
				if (suspendedUntil <= new Date()) {
					throw new BadRequestException(
						'suspendedUntil must be a future date',
					);
				}
				user.suspendedUntil = suspendedUntil;
			}
		}

		if (dto.suspensionReason !== undefined) {
			user.suspensionReason = dto.suspensionReason;
		}

		return this.userRepository.save(user);
	}

	async deleteUserByAdmin(targetUserId: string, currentAdminId: string) {
		if (targetUserId === currentAdminId) {
			throw new BadRequestException('You cannot delete your own account');
		}

		const user = await this.getUserById(targetUserId);
		await this.userRepository.remove(user);
		return { success: true };
	}

	async changeUserPassword(userId: string, newPassword: string) {
		const user = await this.userRepository.findOne({
			where: { id: userId },
			select: ['id', 'password'],
		});
		if (!user) {
			throw new NotFoundException(`User with id ${userId} not found`);
		}
		user.password = await this.passwordEncryption.encrypt(newPassword);
		await this.userRepository.save(user);
		return { success: true };
	}

	async listRoles() {
		return this.roleRepository.find({
			order: { name: 'ASC' },
		});
	}

	async createRole(dto: CreateRoleDto) {
		const exists = await this.roleRepository.findOne({
			where: { name: dto.name },
		});
		if (exists) {
			throw new ConflictException(`Role ${dto.name} already exists`);
		}

		const role = this.roleRepository.create({
			name: dto.name,
			maxWeightSensitiveContent: dto.maxWeightSensitiveContent,
		});

		if (dto.permissions && dto.permissions.length > 0) {
			const permissions = await this.permissionRepository.find({
				where: { name: In(dto.permissions) },
			});
			role.permissions = permissions;
		}

		return this.roleRepository.save(role);
	}

	async updateRole(roleId: string, dto: UpdateRoleDto) {
		const role = await this.roleRepository.findOne({
			where: { id: roleId },
			relations: ['permissions'],
		});
		if (!role) {
			throw new NotFoundException(`Role with id ${roleId} not found`);
		}

		if (dto.name !== undefined && dto.name !== role.name) {
			const exists = await this.roleRepository.findOne({
				where: { name: dto.name },
			});
			if (exists) {
				throw new ConflictException(`Role ${dto.name} already exists`);
			}
			role.name = dto.name;
		}

		if (dto.maxWeightSensitiveContent !== undefined) {
			role.maxWeightSensitiveContent = dto.maxWeightSensitiveContent;
		}

		if (dto.permissions !== undefined) {
			const permissions = await this.permissionRepository.find({
				where: { name: In(dto.permissions) },
			});
			role.permissions = permissions;
		}

		const savedRole = await this.roleRepository.save(role);

		// Invalidate all permissions cache since a role change affects all users with that role
		await this.userPermissionsService.invalidateAllCache();

		return savedRole;
	}

	async listGroups() {
		return this.groupRepository.find({
			relations: ['members'],
			order: { name: 'ASC' },
		});
	}

	async createGroup(dto: CreateGroupDto) {
		const exists = await this.groupRepository.findOne({
			where: { name: dto.name },
		});
		if (exists) {
			throw new ConflictException(`Group ${dto.name} already exists`);
		}
		const group = this.groupRepository.create({
			...dto,
			description: dto.description ?? null,
		});
		return this.groupRepository.save(group);
	}

	async updateGroup(groupId: string, dto: UpdateGroupDto) {
		const group = await this.groupRepository.findOne({
			where: { id: groupId },
		});
		if (!group) {
			throw new NotFoundException(`Group with id ${groupId} not found`);
		}

		if (dto.name !== undefined && dto.name !== group.name) {
			const exists = await this.groupRepository.findOne({
				where: { name: dto.name },
			});
			if (exists) {
				throw new ConflictException(`Group ${dto.name} already exists`);
			}
			group.name = dto.name;
		}

		if (dto.description !== undefined) {
			group.description = dto.description;
		}

		if (dto.defaultMaxWeightSensitiveContent !== undefined) {
			group.defaultMaxWeightSensitiveContent =
				dto.defaultMaxWeightSensitiveContent;
		}

		return this.groupRepository.save(group);
	}

	async deleteGroup(groupId: string) {
		const group = await this.groupRepository.findOne({
			where: { id: groupId },
		});
		if (!group) {
			throw new NotFoundException(`Group with id ${groupId} not found`);
		}
		await this.groupRepository.remove(group);
		return { success: true };
	}

	async addMembersToGroup(groupId: string, userIds: string[]) {
		const group = await this.groupRepository.findOne({
			where: { id: groupId },
			relations: ['members'],
		});
		if (!group) {
			throw new NotFoundException(`Group with id ${groupId} not found`);
		}

		const users = await this.userRepository.find({
			where: { id: In(userIds) },
		});
		if (users.length !== userIds.length) {
			throw new BadRequestException('One or more users were not found');
		}

		const memberById = new Map((group.members || []).map((m) => [m.id, m]));
		for (const user of users) {
			memberById.set(user.id, user);
		}
		group.members = Array.from(memberById.values());
		return this.groupRepository.save(group);
	}

	async removeMemberFromGroup(groupId: string, userId: string) {
		const group = await this.groupRepository.findOne({
			where: { id: groupId },
			relations: ['members'],
		});
		if (!group) {
			throw new NotFoundException(`Group with id ${groupId} not found`);
		}

		group.members = (group.members || []).filter(
			(member) => member.id !== userId,
		);
		return this.groupRepository.save(group);
	}

	async createAccessPolicy(
		dto: CreateAccessPolicyDto,
		currentAdminId: string,
	) {
		if (!dto.targetUserId && !dto.targetGroupId) {
			throw new BadRequestException(
				'targetUserId or targetGroupId is required',
			);
		}
		if (dto.targetUserId && dto.targetGroupId) {
			throw new BadRequestException(
				'Use either targetUserId or targetGroupId, not both',
			);
		}

		if (dto.scope === AccessPolicyScopeEnum.BOOK && !dto.bookId) {
			throw new BadRequestException('bookId is required for scope book');
		}
		if (dto.scope === AccessPolicyScopeEnum.TAG && !dto.tagId) {
			throw new BadRequestException('tagId is required for scope tag');
		}
		if (
			dto.scope === AccessPolicyScopeEnum.SENSITIVE_CONTENT &&
			!dto.sensitiveContentId
		) {
			throw new BadRequestException(
				'sensitiveContentId is required for scope sensitive_content',
			);
		}
		if (
			dto.scope === AccessPolicyScopeEnum.GLOBAL &&
			(dto.bookId || dto.tagId || dto.sensitiveContentId)
		) {
			throw new BadRequestException(
				'global scope cannot define bookId, tagId or sensitiveContentId',
			);
		}

		const policy = this.accessPolicyRepository.create({
			effect: dto.effect,
			scope: dto.scope,
			targetUserId: dto.targetUserId ?? null,
			targetGroupId: dto.targetGroupId ?? null,
			bookId: dto.bookId ?? null,
			tagId: dto.tagId ?? null,
			sensitiveContentId: dto.sensitiveContentId ?? null,
			isActive: dto.isActive ?? true,
			overrideMaxWeightSensitiveContent:
				dto.overrideMaxWeightSensitiveContent ?? null,
			reason: dto.reason ?? null,
			expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
			createdByUserId: currentAdminId,
		});

		return this.accessPolicyRepository.save(policy);
	}

	async listAccessPolicies(query: ListAccessPoliciesQueryDto) {
		const qb = this.accessPolicyRepository
			.createQueryBuilder('policy')
			.orderBy('policy.createdAt', 'DESC');

		if (query.effect) {
			qb.andWhere('policy.effect = :effect', { effect: query.effect });
		}
		if (query.scope) {
			qb.andWhere('policy.scope = :scope', { scope: query.scope });
		}
		if (query.targetUserId) {
			qb.andWhere('policy.targetUserId = :targetUserId', {
				targetUserId: query.targetUserId,
			});
		}
		if (query.targetGroupId) {
			qb.andWhere('policy.targetGroupId = :targetGroupId', {
				targetGroupId: query.targetGroupId,
			});
		}
		if (query.isActive !== undefined) {
			qb.andWhere('policy.isActive = :isActive', {
				isActive: query.isActive === 'true',
			});
		}

		return qb.getMany();
	}

	async deleteAccessPolicy(policyId: string) {
		const policy = await this.accessPolicyRepository.findOne({
			where: { id: policyId },
		});
		if (!policy) {
			throw new NotFoundException(
				`Access policy with id ${policyId} not found`,
			);
		}
		await this.accessPolicyRepository.remove(policy);
		return { success: true };
	}

	async sendNotification(userId: string, title: string, message: string) {
		const user = await this.getUserById(userId);

		this.mqttClient.emit(`users/${user.id}/notifications`, {
			event: 'system.alert',
			payload: {
				isTranslatable: false,
				title,
				message,
				timestamp: new Date().toISOString(),
				data: {},
			},
		});

		this.webPushService.notifyUser(user.id, {
			title,
			body: message,
			url: '/notifications',
		});

		return { success: true, message: 'Notification sent successfully' };
	}

	async sendBulkNotification(
		userIds: string[],
		title: string,
		message: string,
	) {
		const users = await this.userRepository.find({
			where: { id: In(userIds) },
			select: ['id'],
		});

		const timestamp = new Date().toISOString();

		for (const user of users) {
			this.mqttClient.emit(`users/${user.id}/notifications`, {
				event: 'system.alert',
				payload: {
					isTranslatable: false,
					title,
					message,
					timestamp,
					data: {},
				},
			});

			this.webPushService.notifyUser(user.id, {
				title,
				body: message,
				url: '/notifications',
			});
		}

		return { success: true, count: users.length };
	}
}
