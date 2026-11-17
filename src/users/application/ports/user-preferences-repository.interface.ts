import { UserId } from '@common/domain/value-objects/user-id.vo';
import { UserPreferences } from '@users/domain/entities/user-preferences';
import { PreferenceSectionName } from '@users/domain/value-objects/preference-section-name.vo';
import { PreferenceSection } from '@users/domain/value-objects/preference-section.vo';

/**
 * Decides which section wins against the stored one. Contract: return the
 * stored section (or an equal copy) to keep it, or a section with a different
 * revision (`updatedAt`) to replace it. A section that carries the stored
 * revision but different content is treated as "kept" and is not persisted.
 */
export type PreferenceSectionResolver = (
	stored: PreferenceSection,
) => PreferenceSection;

export interface IUserPreferencesRepository {
	/** Returns null when the user does not exist. */
	find(userId: UserId): Promise<UserPreferences | null>;

	/**
	 * Atomically reads the stored section, asks the resolver which section wins
	 * and persists the winner without touching other sections; nothing is
	 * written when the winner has the stored revision. Returns the
	 * winner, or null when the user does not exist.
	 */
	updateSection(
		userId: UserId,
		name: PreferenceSectionName,
		resolve: PreferenceSectionResolver,
	): Promise<PreferenceSection | null>;
}

export const I_USER_PREFERENCES_REPOSITORY = 'IUserPreferencesRepository';
