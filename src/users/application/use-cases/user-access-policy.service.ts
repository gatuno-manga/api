import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AccessPolicyEffectEnum } from '@users/domain/enums/access-policy-effect.enum';
import { AccessPolicyScopeEnum } from '@users/domain/enums/access-policy-scope.enum';
import { AccessPolicy } from '@users/infrastructure/database/entities/access-policy.entity';
import { User } from '@users/infrastructure/database/entities/user.entity';
import { Brackets, Repository } from 'typeorm';

@Injectable()
export class UserAccessPolicyService {
	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(AccessPolicy)
		private readonly accessPolicyRepository: Repository<AccessPolicy>,
	) {}

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
		bookSensitiveContentWeights: number[];
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

		// Check if any book content weight exceeds effective user weight
		// and it's NOT explicitly allowed by a policy above
		const maxBookContentWeight = params.bookSensitiveContentWeights.reduce(
			(max, w) => Math.max(max, w),
			0,
		);

		if (
			maxBookContentWeight > effectiveMaxWeight &&
			allowBookWeight === 0 &&
			allowTagWeight === 0 &&
			allowSensitiveContentWeight === 0
		) {
			return {
				blocked: true,
				effectiveMaxWeightSensitiveContent: effectiveMaxWeight,
			};
		}

		return {
			blocked: false,
			effectiveMaxWeightSensitiveContent: effectiveMaxWeight,
		};
	}
}
