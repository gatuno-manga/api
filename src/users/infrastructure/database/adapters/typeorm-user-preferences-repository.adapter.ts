import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	IUserPreferencesRepository,
	PreferenceSectionResolver,
} from '@users/application/ports/user-preferences-repository.interface';
import { UserPreferences } from '@users/domain/entities/user-preferences';
import {
	PreferenceDocument,
	isPreferenceDocument,
} from '@users/domain/value-objects/preference-data.vo';
import { PreferenceSectionName } from '@users/domain/value-objects/preference-section-name.vo';
import { PreferenceSection } from '@users/domain/value-objects/preference-section.vo';
import { User } from '@users/infrastructure/database/entities/user.entity';
import { EntityManager, Repository } from 'typeorm';

@Injectable()
export class TypeOrmUserPreferencesRepositoryAdapter
	implements IUserPreferencesRepository
{
	constructor(
		@InjectRepository(User)
		private readonly repository: Repository<User>,
	) {}

	async find(userId: UserId): Promise<UserPreferences | null> {
		const user = await this.repository.findOne({
			select: { id: true, preferences: true },
			where: { id: userId.toString() },
			loadEagerRelations: false,
		});
		if (!user) {
			return null;
		}
		return UserPreferences.fromDocument(user.preferences);
	}

	async updateSection(
		userId: UserId,
		name: PreferenceSectionName,
		resolve: PreferenceSectionResolver,
	): Promise<PreferenceSection | null> {
		return this.repository.manager.transaction(async (manager) => {
			const document = await this.lockDocument(manager, userId);
			if (!document) {
				return null;
			}
			const stored = UserPreferences.fromDocument(document).section(name);
			const winner = resolve(stored);
			if (winner.hasSameRevisionAs(stored)) {
				return winner;
			}
			const preferences: PreferenceDocument = {
				...document,
				[name.toString()]: winner.toSnapshot(),
			};
			// The column is `update: false` on the entity so whole-entity saves
			// cannot write back a stale copy; after insert, this is its only writer.
			await manager.query(
				'UPDATE users SET preferences = ? WHERE id = ?',
				[JSON.stringify(preferences), userId.toString()],
			);
			return winner;
		});
	}

	/** Reads the raw preferences document under a row lock; null when the user does not exist. */
	private async lockDocument(
		manager: EntityManager,
		userId: UserId,
	): Promise<PreferenceDocument | null> {
		const user = await manager
			.getRepository(User)
			.createQueryBuilder('user')
			.select(['user.id', 'user.preferences'])
			.where('user.id = :id', { id: userId.toString() })
			.setLock('pessimistic_write')
			.getOne();
		if (!user) {
			return null;
		}
		return isPreferenceDocument(user.preferences) ? user.preferences : {};
	}
}
