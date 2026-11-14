import { DomainException } from '@common/domain/exceptions/domain.exception';
import { ResourceNotFoundException } from '@common/domain/exceptions/resource-not-found.exception';
import { MAX_PREFERENCE_DATA_BYTES } from './preference-data.vo';
import { PreferenceSectionName } from './preference-section-name.vo';
import {
	MAX_CLOCK_SKEW_MILLISECONDS,
	PreferenceSection,
} from './preference-section.vo';

const NOW = new Date('2026-11-14T12:00:00.000Z');

function storedSection(updatedAt: string, data = { fontSize: 18 }) {
	return PreferenceSection.restore({ data, updatedAt });
}

describe('PreferenceSection', () => {
	describe('last write wins on the client timestamp', () => {
		it('replaces the stored section when the incoming change is strictly newer', () => {
			// Arrange
			const stored = storedSection('2026-11-14T11:00:00.000Z');
			const incoming = PreferenceSection.write(
				{ fontSize: 20 },
				new Date('2026-11-14T11:30:00.000Z'),
				NOW,
			);

			// Act
			const winner = incoming.resolveAgainst(stored);

			// Assert
			expect(winner.toSnapshot()).toEqual({
				data: { fontSize: 20 },
				updatedAt: '2026-11-14T11:30:00.000Z',
			});
		});

		it('keeps the stored section when an offline device pushes an older change', () => {
			// Arrange
			const stored = storedSection('2026-11-14T11:00:00.000Z');
			const incoming = PreferenceSection.write(
				{ fontSize: 20 },
				new Date('2026-11-14T10:00:00.000Z'),
				NOW,
			);

			// Act
			const winner = incoming.resolveAgainst(stored);

			// Assert
			expect(winner).toBe(stored);
		});

		it('keeps the stored section on a tie so a replayed write is a no-op', () => {
			// Arrange
			const stored = storedSection('2026-11-14T11:00:00.000Z');
			const incoming = PreferenceSection.write(
				{ fontSize: 20 },
				new Date('2026-11-14T11:00:00.000Z'),
				NOW,
			);

			// Act
			const winner = incoming.resolveAgainst(stored);

			// Assert
			expect(winner).toBe(stored);
		});

		it('wins against a section that was never saved', () => {
			// Arrange
			const incoming = PreferenceSection.write(
				{ fontSize: 20 },
				new Date('2000-01-01T00:00:00.000Z'),
				NOW,
			);

			// Act
			const winner = incoming.resolveAgainst(PreferenceSection.empty());

			// Assert
			expect(winner).toBe(incoming);
		});
	});

	describe('client clock skew', () => {
		it('accepts a timestamp up to five minutes ahead of the server', () => {
			// Arrange
			const updatedAt = new Date(
				NOW.getTime() + MAX_CLOCK_SKEW_MILLISECONDS,
			);

			// Act
			const write = () =>
				PreferenceSection.write({ fontSize: 20 }, updatedAt, NOW);

			// Assert
			expect(write).not.toThrow();
		});

		it('rejects a timestamp further in the future so a skewed clock cannot win forever', () => {
			// Arrange
			const updatedAt = new Date(
				NOW.getTime() + MAX_CLOCK_SKEW_MILLISECONDS + 1,
			);

			// Act
			const write = () =>
				PreferenceSection.write({ fontSize: 20 }, updatedAt, NOW);

			// Assert
			expect(write).toThrow(DomainException);
		});

		it('rejects an invalid date', () => {
			// Act
			const write = () =>
				PreferenceSection.write({}, new Date('not a date'), NOW);

			// Assert
			expect(write).toThrow(DomainException);
		});
	});

	describe('payload rules', () => {
		it.each([
			['an array', [1, 2]],
			['null', null],
			['a string', 'serif'],
			['a number', 19],
		])('rejects %s because data must be a JSON object', (_label, data) => {
			// Act
			const write = () => PreferenceSection.write(data, NOW, NOW);

			// Assert
			expect(write).toThrow(DomainException);
		});

		it('accepts data exactly at the 16 KB cap', () => {
			// Arrange: {"padding":"..."} is 14 bytes of overhead
			const data = {
				padding: 'a'.repeat(MAX_PREFERENCE_DATA_BYTES - 14),
			};

			// Act
			const write = () => PreferenceSection.write(data, NOW, NOW);

			// Assert
			expect(write).not.toThrow();
		});

		it('rejects data one byte over the 16 KB cap', () => {
			// Arrange
			const data = {
				padding: 'a'.repeat(MAX_PREFERENCE_DATA_BYTES - 13),
			};

			// Act
			const write = () => PreferenceSection.write(data, NOW, NOW);

			// Assert
			expect(write).toThrow(DomainException);
		});

		it('counts multi-byte characters as bytes, not as string length', () => {
			// Arrange: each "é" is 2 bytes in UTF-8
			const data = { padding: 'é'.repeat(MAX_PREFERENCE_DATA_BYTES / 2) };

			// Act
			const write = () => PreferenceSection.write(data, NOW, NOW);

			// Assert
			expect(write).toThrow(DomainException);
		});

		it('keeps unknown client fields untouched because the payload is opaque', () => {
			// Arrange
			const data = { version: 3, futureOption: { nested: [1, 'two'] } };

			// Act
			const snapshot = PreferenceSection.write(
				data,
				NOW,
				NOW,
			).toSnapshot();

			// Assert
			expect(snapshot.data).toEqual(data);
		});
	});

	describe('restoring stored sections', () => {
		it('reports a never-saved section as nulls', () => {
			// Act
			const snapshot = PreferenceSection.restore(undefined).toSnapshot();

			// Assert
			expect(snapshot).toEqual({ data: null, updatedAt: null });
		});

		it.each([
			['a string', 'dark'],
			[
				'data that is not an object',
				{ data: 'x', updatedAt: NOW.toISOString() },
			],
			['a missing timestamp', { data: { fontSize: 18 } }],
			['an unparseable timestamp', { data: {}, updatedAt: 'yesterday' }],
		])(
			'treats %s left by the old free-form preferences as never saved',
			(_label, stored) => {
				// Act
				const snapshot = PreferenceSection.restore(stored).toSnapshot();

				// Assert
				expect(snapshot).toEqual({ data: null, updatedAt: null });
			},
		);
	});
});

describe('PreferenceSectionName', () => {
	it('accepts the reader section', () => {
		// Act
		const name = PreferenceSectionName.create('reader');

		// Assert
		expect(name.toString()).toBe('reader');
	});

	it('rejects sections outside the allow-list as not found', () => {
		// Act
		const create = () => PreferenceSectionName.create('theme');

		// Assert
		expect(create).toThrow(ResourceNotFoundException);
	});
});
