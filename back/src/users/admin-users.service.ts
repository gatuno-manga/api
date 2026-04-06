import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { CreateAccessPolicyDto } from './dto/create-access-policy.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { ListAccessPoliciesQueryDto } from './dto/list-access-policies-query.dto';
import { SetUserModerationDto } from './dto/set-user-moderation.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AccessPolicy } from './entities/access-policy.entity';
import { Role } from './entities/role.entity';
import { UserGroup } from './entities/user-group.entity';
import { User } from './entities/user.entity';
import { AccessPolicyEffectEnum } from './enum/access-policy-effect.enum';
import { AccessPolicyScopeEnum } from './enum/access-policy-scope.enum';
import { RolesEnum } from './enum/roles.enum';

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
	) {}

	async listUsers(params: {
		page: number;
		limit: number;
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

		qb.orderBy('user.createdAt', 'DESC')
			.skip((page - 1) * limit)
			.take(limit);

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
			!roles.some((role) => role.name === RolesEnum.ADMIN)
		) {
			throw new BadRequestException(
				'You cannot remove your own admin role',
			);
		}

		user.roles = roles;
		return this.userRepository.save(user);
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
		const role = this.roleRepository.create(dto);
		return this.roleRepository.save(role);
	}

	async updateRole(roleId: string, dto: UpdateRoleDto) {
		const role = await this.roleRepository.findOne({
			where: { id: roleId },
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

		return this.roleRepository.save(role);
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

	async evaluateListAccessContext(params: {
		userId?: string;
		baseMaxWeightSensitiveContent: number;
	}) {
		const emptyContext = {
			blockedAll: false,
			effectiveMaxWeightSensitiveContent:
				params.baseMaxWeightSensitiveContent,
			denyBookIds: [] as string[],
			denyTagIds: [] as string[],
			allowBookIds: [] as string[],
			allowTagIds: [] as string[],
			denySensitiveContentIds: [] as string[],
			allowSensitiveContentIds: [] as string[],
			allowBookWeightById: {} as Record<string, number>,
			allowTagWeightById: {} as Record<string, number>,
			allowSensitiveContentWeightById: {} as Record<string, number>,
		};

		if (!params.userId) {
			return emptyContext;
		}

		const user = await this.userRepository.findOne({
			where: { id: params.userId },
			relations: ['groups'],
		});

		if (!user) {
			return emptyContext;
		}

		const groupIds = (user.groups || []).map((group) => group.id);
		const policyQb = this.accessPolicyRepository
			.createQueryBuilder('policy')
			.where('policy.isActive = :isActive', { isActive: true })
			.andWhere('(policy.expiresAt IS NULL OR policy.expiresAt > :now)', {
				now: new Date(),
			})
			.andWhere(
				new Brackets((query) => {
					query.where('policy.targetUserId = :userId', {
						userId: params.userId,
					});
					if (groupIds.length > 0) {
						query.orWhere(
							'policy.targetGroupId IN (:...groupIds)',
							{
								groupIds,
							},
						);
					}
				}),
			);

		const policies = await policyQb.getMany();

		if (!policies.length) {
			return emptyContext;
		}

		const getPolicyWeight = (policy: AccessPolicy) =>
			policy.overrideMaxWeightSensitiveContent === null ||
			policy.overrideMaxWeightSensitiveContent === undefined
				? 99
				: policy.overrideMaxWeightSensitiveContent;

		type SourceDecision = {
			globalDecision: 'allow' | 'deny' | null;
			globalAllowWeight: number;
			denyBookIds: Set<string>;
			denyTagIds: Set<string>;
			denySensitiveContentIds: Set<string>;
			allowBookWeightById: Map<string, number>;
			allowTagWeightById: Map<string, number>;
			allowSensitiveContentWeightById: Map<string, number>;
		};

		const buildSourceDecision = (
			sourcePolicies: AccessPolicy[],
		): SourceDecision => {
			let hasGlobalAllow = false;
			let hasGlobalDeny = false;
			let globalAllowWeight = params.baseMaxWeightSensitiveContent;

			const denyBookIds = new Set<string>();
			const denyTagIds = new Set<string>();
			const denySensitiveContentIds = new Set<string>();
			const allowBookWeightById = new Map<string, number>();
			const allowTagWeightById = new Map<string, number>();
			const allowSensitiveContentWeightById = new Map<string, number>();

			for (const policy of sourcePolicies) {
				if (policy.scope === AccessPolicyScopeEnum.GLOBAL) {
					if (policy.effect === AccessPolicyEffectEnum.DENY) {
						hasGlobalDeny = true;
						continue;
					}

					hasGlobalAllow = true;
					globalAllowWeight = Math.max(
						globalAllowWeight,
						getPolicyWeight(policy),
					);
					continue;
				}

				if (policy.effect === AccessPolicyEffectEnum.DENY) {
					if (
						policy.scope === AccessPolicyScopeEnum.BOOK &&
						policy.bookId
					) {
						denyBookIds.add(policy.bookId);
					}
					if (
						policy.scope === AccessPolicyScopeEnum.TAG &&
						policy.tagId
					) {
						denyTagIds.add(policy.tagId);
					}
					if (
						policy.scope ===
							AccessPolicyScopeEnum.SENSITIVE_CONTENT &&
						policy.sensitiveContentId
					) {
						denySensitiveContentIds.add(policy.sensitiveContentId);
					}
					continue;
				}

				if (
					policy.scope === AccessPolicyScopeEnum.BOOK &&
					policy.bookId
				) {
					allowBookWeightById.set(
						policy.bookId,
						Math.max(
							allowBookWeightById.get(policy.bookId) ?? 0,
							getPolicyWeight(policy),
						),
					);
				}

				if (
					policy.scope === AccessPolicyScopeEnum.TAG &&
					policy.tagId
				) {
					allowTagWeightById.set(
						policy.tagId,
						Math.max(
							allowTagWeightById.get(policy.tagId) ?? 0,
							getPolicyWeight(policy),
						),
					);
				}

				if (
					policy.scope === AccessPolicyScopeEnum.SENSITIVE_CONTENT &&
					policy.sensitiveContentId
				) {
					allowSensitiveContentWeightById.set(
						policy.sensitiveContentId,
						Math.max(
							allowSensitiveContentWeightById.get(
								policy.sensitiveContentId,
							) ?? 0,
							getPolicyWeight(policy),
						),
					);
				}
			}

			for (const deniedBookId of denyBookIds) {
				allowBookWeightById.delete(deniedBookId);
			}
			for (const deniedTagId of denyTagIds) {
				allowTagWeightById.delete(deniedTagId);
			}
			for (const deniedSensitiveContentId of denySensitiveContentIds) {
				allowSensitiveContentWeightById.delete(
					deniedSensitiveContentId,
				);
			}

			let globalDecision: 'allow' | 'deny' | null = null;
			if (hasGlobalDeny) {
				globalDecision = 'deny';
			} else if (hasGlobalAllow) {
				globalDecision = 'allow';
			}

			return {
				globalDecision,
				globalAllowWeight,
				denyBookIds,
				denyTagIds,
				denySensitiveContentIds,
				allowBookWeightById,
				allowTagWeightById,
				allowSensitiveContentWeightById,
			};
		};

		const userPolicies = policies.filter(
			(policy) => policy.targetUserId === params.userId,
		);
		const groupPolicies = policies.filter(
			(policy) =>
				!!policy.targetGroupId &&
				groupIds.includes(policy.targetGroupId),
		);

		const userDecision = buildSourceDecision(userPolicies);
		const groupDecision = buildSourceDecision(groupPolicies);

		let blockedAll = false;
		let effectiveMaxWeight = params.baseMaxWeightSensitiveContent;

		if (userDecision.globalDecision === 'deny') {
			blockedAll = true;
		} else if (userDecision.globalDecision === 'allow') {
			effectiveMaxWeight = Math.max(
				effectiveMaxWeight,
				userDecision.globalAllowWeight,
			);
		} else if (groupDecision.globalDecision === 'deny') {
			blockedAll = true;
		} else if (groupDecision.globalDecision === 'allow') {
			effectiveMaxWeight = Math.max(
				effectiveMaxWeight,
				groupDecision.globalAllowWeight,
			);
		}

		const effectiveDenyBookIds = new Set(groupDecision.denyBookIds);
		const effectiveDenyTagIds = new Set(groupDecision.denyTagIds);
		const effectiveDenySensitiveContentIds = new Set(
			groupDecision.denySensitiveContentIds,
		);
		const effectiveAllowBookWeightById = new Map(
			groupDecision.allowBookWeightById,
		);
		const effectiveAllowTagWeightById = new Map(
			groupDecision.allowTagWeightById,
		);
		const effectiveAllowSensitiveContentWeightById = new Map(
			groupDecision.allowSensitiveContentWeightById,
		);

		for (const [bookId, weight] of userDecision.allowBookWeightById) {
			effectiveDenyBookIds.delete(bookId);
			effectiveAllowBookWeightById.set(bookId, weight);
		}

		for (const [tagId, weight] of userDecision.allowTagWeightById) {
			effectiveDenyTagIds.delete(tagId);
			effectiveAllowTagWeightById.set(tagId, weight);
		}

		for (const [
			sensitiveContentId,
			weight,
		] of userDecision.allowSensitiveContentWeightById) {
			effectiveDenySensitiveContentIds.delete(sensitiveContentId);
			effectiveAllowSensitiveContentWeightById.set(
				sensitiveContentId,
				weight,
			);
		}

		for (const bookId of userDecision.denyBookIds) {
			effectiveAllowBookWeightById.delete(bookId);
			effectiveDenyBookIds.add(bookId);
		}

		for (const tagId of userDecision.denyTagIds) {
			effectiveAllowTagWeightById.delete(tagId);
			effectiveDenyTagIds.add(tagId);
		}

		for (const sensitiveContentId of userDecision.denySensitiveContentIds) {
			effectiveAllowSensitiveContentWeightById.delete(sensitiveContentId);
			effectiveDenySensitiveContentIds.add(sensitiveContentId);
		}

		const maxSensitiveContentAllowWeight = Array.from(
			effectiveAllowSensitiveContentWeightById.values(),
		).reduce((maxWeight, weight) => Math.max(maxWeight, weight), 0);

		effectiveMaxWeight = Math.max(
			effectiveMaxWeight,
			maxSensitiveContentAllowWeight,
		);

		return {
			blockedAll,
			effectiveMaxWeightSensitiveContent: effectiveMaxWeight,
			denyBookIds: Array.from(effectiveDenyBookIds),
			denyTagIds: Array.from(effectiveDenyTagIds),
			denySensitiveContentIds: Array.from(
				effectiveDenySensitiveContentIds,
			),
			allowBookIds: Array.from(effectiveAllowBookWeightById.keys()),
			allowTagIds: Array.from(effectiveAllowTagWeightById.keys()),
			allowSensitiveContentIds: Array.from(
				effectiveAllowSensitiveContentWeightById.keys(),
			),
			allowBookWeightById: Object.fromEntries(
				effectiveAllowBookWeightById,
			),
			allowTagWeightById: Object.fromEntries(effectiveAllowTagWeightById),
			allowSensitiveContentWeightById: Object.fromEntries(
				effectiveAllowSensitiveContentWeightById,
			),
		};
	}

	async evaluateAccessForBook(params: {
		userId?: string;
		bookId: string;
		bookTagIds: string[];
		bookSensitiveContentIds: string[];
		baseMaxWeightSensitiveContent: number;
	}) {
		const context = await this.evaluateListAccessContext({
			userId: params.userId,
			baseMaxWeightSensitiveContent: params.baseMaxWeightSensitiveContent,
		});

		if (context.blockedAll) {
			return {
				blocked: true,
				effectiveMaxWeightSensitiveContent:
					context.effectiveMaxWeightSensitiveContent,
			};
		}

		if (
			context.denyBookIds.includes(params.bookId) ||
			params.bookTagIds.some((tagId) =>
				context.denyTagIds.includes(tagId),
			) ||
			params.bookSensitiveContentIds.some((sensitiveContentId) =>
				context.denySensitiveContentIds.includes(sensitiveContentId),
			)
		) {
			return {
				blocked: true,
				effectiveMaxWeightSensitiveContent:
					context.effectiveMaxWeightSensitiveContent,
			};
		}

		let effectiveMaxWeight = context.effectiveMaxWeightSensitiveContent;
		const allowBookWeight = context.allowBookWeightById[params.bookId] ?? 0;
		const allowTagWeight = params.bookTagIds.reduce((maxWeight, tagId) => {
			const tagWeight = context.allowTagWeightById[tagId] ?? 0;
			return Math.max(maxWeight, tagWeight);
		}, 0);
		const allowSensitiveContentWeight =
			params.bookSensitiveContentIds.reduce(
				(maxWeight, sensitiveContentId) => {
					const sensitiveContentWeight =
						context.allowSensitiveContentWeightById[
							sensitiveContentId
						] ?? 0;
					return Math.max(maxWeight, sensitiveContentWeight);
				},
				0,
			);

		if (
			allowBookWeight > 0 ||
			allowTagWeight > 0 ||
			allowSensitiveContentWeight > 0
		) {
			effectiveMaxWeight = Math.max(
				effectiveMaxWeight,
				allowBookWeight,
				allowTagWeight,
				allowSensitiveContentWeight,
			);
		}

		return {
			blocked: false,
			effectiveMaxWeightSensitiveContent: effectiveMaxWeight,
		};
	}
}
