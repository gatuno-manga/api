import { ResourceNotFoundException } from '@common/domain/exceptions/resource-not-found.exception';

export const PREFERENCE_SECTION_NAMES: readonly string[] = ['reader'];

export class PreferenceSectionName {
	private constructor(private readonly value: string) {}

	public static create(value: string): PreferenceSectionName {
		if (!PREFERENCE_SECTION_NAMES.includes(value)) {
			throw new ResourceNotFoundException(
				`Unknown preference section: ${value}`,
			);
		}
		return new PreferenceSectionName(value);
	}

	public static all(): PreferenceSectionName[] {
		return PREFERENCE_SECTION_NAMES.map(
			(value) => new PreferenceSectionName(value),
		);
	}

	public toString(): string {
		return this.value;
	}
}
