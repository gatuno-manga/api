import { DomainException } from '@common/domain/exceptions/domain.exception';
import {
	PreferenceData,
	PreferenceDocument,
	isPreferenceDocument,
} from './preference-data.vo';

export const MAX_CLOCK_SKEW_MILLISECONDS = 5 * 60 * 1000;

export interface PreferenceSectionSnapshot {
	data: PreferenceDocument | null;
	updatedAt: string | null;
}

/**
 * One named block of a user's preferences, stamped with the client time of
 * its last change. Conflicts are resolved by last write wins on that time.
 */
export class PreferenceSection {
	private constructor(
		private readonly data: PreferenceData | null,
		private readonly updatedAt: Date | null,
	) {}

	public static empty(): PreferenceSection {
		return new PreferenceSection(null, null);
	}

	/** Rebuilds a stored section; anything malformed counts as never saved. */
	public static restore(stored: unknown): PreferenceSection {
		if (!isPreferenceDocument(stored)) {
			return PreferenceSection.empty();
		}
		const data = PreferenceData.restore(stored.data);
		const updatedAt = PreferenceSection.parseStoredDate(stored.updatedAt);
		if (!data || !updatedAt) {
			return PreferenceSection.empty();
		}
		return new PreferenceSection(data, updatedAt);
	}

	/** Builds a client write, rejecting timestamps a skewed clock pushed into the future. */
	public static write(
		data: unknown,
		updatedAt: Date,
		now: Date,
	): PreferenceSection {
		PreferenceSection.assertValidClientTime(updatedAt, now);
		return new PreferenceSection(PreferenceData.create(data), updatedAt);
	}

	private static parseStoredDate(value: unknown): Date | null {
		if (typeof value !== 'string') {
			return null;
		}
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? null : date;
	}

	private static assertValidClientTime(updatedAt: Date, now: Date): void {
		if (Number.isNaN(updatedAt.getTime())) {
			throw new DomainException('updatedAt must be a valid date');
		}
		if (updatedAt.getTime() - now.getTime() > MAX_CLOCK_SKEW_MILLISECONDS) {
			throw new DomainException('updatedAt must not be in the future');
		}
	}

	/** Returns whichever of this write and the stored section wins; ties keep the stored one. */
	public resolveAgainst(stored: PreferenceSection): PreferenceSection {
		return this.isNewerThan(stored) ? this : stored;
	}

	/**
	 * True when both sections carry the same revision timestamp. Because only a
	 * strictly newer write wins, a resolved winner with the stored revision means
	 * the stored section was kept and nothing needs to be persisted.
	 */
	public hasSameRevisionAs(other: PreferenceSection): boolean {
		if (!this.updatedAt || !other.updatedAt) {
			return this.updatedAt === other.updatedAt;
		}
		return this.updatedAt.getTime() === other.updatedAt.getTime();
	}

	private isNewerThan(other: PreferenceSection): boolean {
		if (!this.updatedAt) {
			return false;
		}
		if (!other.updatedAt) {
			return true;
		}
		return this.updatedAt.getTime() > other.updatedAt.getTime();
	}

	public toSnapshot(): PreferenceSectionSnapshot {
		return {
			data: this.data ? this.data.toDocument() : null,
			updatedAt: this.updatedAt ? this.updatedAt.toISOString() : null,
		};
	}
}
