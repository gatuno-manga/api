import { ResourceNotFoundException } from '@common/domain/exceptions/resource-not-found.exception';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Inject, Injectable } from '@nestjs/common';
import {
	IUserPreferencesRepository,
	I_USER_PREFERENCES_REPOSITORY,
} from '@users/application/ports/user-preferences-repository.interface';
import { UserPreferences } from '@users/domain/entities/user-preferences';
import { PreferenceSectionName } from '@users/domain/value-objects/preference-section-name.vo';
import {
	PreferenceSection,
	PreferenceSectionSnapshot,
} from '@users/domain/value-objects/preference-section.vo';

@Injectable()
export class UserPreferencesService {
	constructor(
		@Inject(I_USER_PREFERENCES_REPOSITORY)
		private readonly preferencesRepository: IUserPreferencesRepository,
	) {}

	async getPreferences(
		userId: string,
	): Promise<Record<string, PreferenceSectionSnapshot>> {
		const preferences = await this.findPreferencesOrFail(userId);
		return preferences.toSnapshot();
	}

	async getSection(
		userId: string,
		section: string,
	): Promise<PreferenceSectionSnapshot> {
		const name = PreferenceSectionName.create(section);
		const preferences = await this.findPreferencesOrFail(userId);
		return preferences.section(name).toSnapshot();
	}

	async putSection(
		userId: string,
		section: string,
		data: unknown,
		updatedAt: Date,
	): Promise<PreferenceSectionSnapshot> {
		const name = PreferenceSectionName.create(section);
		const incoming = PreferenceSection.write(data, updatedAt, new Date());
		const winner = await this.preferencesRepository.updateSection(
			UserId.create(userId),
			name,
			(stored) => incoming.resolveAgainst(stored),
		);
		if (!winner) {
			throw this.userNotFound(userId);
		}
		return winner.toSnapshot();
	}

	private async findPreferencesOrFail(
		userId: string,
	): Promise<UserPreferences> {
		const preferences = await this.preferencesRepository.find(
			UserId.create(userId),
		);
		if (!preferences) {
			throw this.userNotFound(userId);
		}
		return preferences;
	}

	private userNotFound(userId: string): ResourceNotFoundException {
		return new ResourceNotFoundException(
			`User with id ${userId} not found`,
		);
	}
}
