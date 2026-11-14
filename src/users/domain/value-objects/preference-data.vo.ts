import { DomainException } from '@common/domain/exceptions/domain.exception';

export const MAX_PREFERENCE_DATA_BYTES = 16 * 1024;

export type PreferenceDocument = Record<string, unknown>;

export function isPreferenceDocument(
	value: unknown,
): value is PreferenceDocument {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Opaque client-owned payload of a preference section. The server only
 * guarantees it is a JSON object within the size cap; its fields belong to
 * the client, which also owns any versioning inside it.
 */
export class PreferenceData {
	private constructor(private readonly document: PreferenceDocument) {}

	public static create(value: unknown): PreferenceData {
		if (!isPreferenceDocument(value)) {
			throw new DomainException('Preference data must be a JSON object');
		}
		PreferenceData.assertWithinSizeCap(value);
		return new PreferenceData(value);
	}

	/** Rebuilds stored data without re-applying write rules; malformed data is dropped. */
	public static restore(value: unknown): PreferenceData | null {
		if (!isPreferenceDocument(value)) {
			return null;
		}
		return new PreferenceData(value);
	}

	private static assertWithinSizeCap(value: PreferenceDocument): void {
		const sizeInBytes = new TextEncoder().encode(
			JSON.stringify(value),
		).length;
		if (sizeInBytes > MAX_PREFERENCE_DATA_BYTES) {
			throw new DomainException(
				`Preference data must not exceed ${MAX_PREFERENCE_DATA_BYTES} bytes`,
			);
		}
	}

	public toDocument(): PreferenceDocument {
		return this.document;
	}
}
