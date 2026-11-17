import { isPreferenceDocument } from '@users/domain/value-objects/preference-data.vo';
import { PreferenceSectionName } from '@users/domain/value-objects/preference-section-name.vo';
import {
	PreferenceSection,
	PreferenceSectionSnapshot,
} from '@users/domain/value-objects/preference-section.vo';

/**
 * The allow-listed sections of a user's preferences document. Keys outside the
 * allow-list are ignored, so legacy free-form preferences are never exposed.
 */
export class UserPreferences {
	private constructor(
		private readonly sections: Map<string, PreferenceSection>,
	) {}

	public static fromDocument(document: unknown): UserPreferences {
		const source = isPreferenceDocument(document) ? document : {};
		const sections = new Map<string, PreferenceSection>();
		for (const name of PreferenceSectionName.all()) {
			const key = name.toString();
			sections.set(key, PreferenceSection.restore(source[key]));
		}
		return new UserPreferences(sections);
	}

	public section(name: PreferenceSectionName): PreferenceSection {
		return this.sections.get(name.toString()) ?? PreferenceSection.empty();
	}

	public toSnapshot(): Record<string, PreferenceSectionSnapshot> {
		const snapshot: Record<string, PreferenceSectionSnapshot> = {};
		for (const [key, section] of this.sections) {
			snapshot[key] = section.toSnapshot();
		}
		return snapshot;
	}
}
