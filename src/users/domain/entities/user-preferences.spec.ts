import { PreferenceSectionName } from '@users/domain/value-objects/preference-section-name.vo';
import { UserPreferences } from './user-preferences';

describe('UserPreferences', () => {
	const reader = PreferenceSectionName.create('reader');

	it('exposes every allow-listed section, even when never saved', () => {
		// Act
		const snapshot = UserPreferences.fromDocument({}).toSnapshot();

		// Assert
		expect(snapshot).toEqual({ reader: { data: null, updatedAt: null } });
	});

	it('hides legacy free-form keys that are not allow-listed sections', () => {
		// Arrange
		const document = {
			theme: 'dark',
			language: 'pt',
			reader: {
				data: { fontSize: 19 },
				updatedAt: '2026-11-14T12:00:00.000Z',
			},
		};

		// Act
		const snapshot = UserPreferences.fromDocument(document).toSnapshot();

		// Assert
		expect(snapshot).toEqual({
			reader: {
				data: { fontSize: 19 },
				updatedAt: '2026-11-14T12:00:00.000Z',
			},
		});
	});

	it.each([null, undefined, [], 'text'])(
		'treats a non-object document (%p) as empty',
		(document) => {
			// Act
			const section =
				UserPreferences.fromDocument(document).section(reader);

			// Assert
			expect(section.toSnapshot()).toEqual({
				data: null,
				updatedAt: null,
			});
		},
	);
});
