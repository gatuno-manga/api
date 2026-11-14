import { DomainException } from '@common/domain/exceptions/domain.exception';
import { ResourceNotFoundException } from '@common/domain/exceptions/resource-not-found.exception';
import {
	IUserPreferencesRepository,
	PreferenceSectionResolver,
} from '@users/application/ports/user-preferences-repository.interface';
import { UserPreferences } from '@users/domain/entities/user-preferences';
import { PreferenceSection } from '@users/domain/value-objects/preference-section.vo';
import { UserPreferencesService } from './user-preferences.service';

const USER_ID = '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const STORED_AT = '2026-11-14T11:00:00.000Z';

describe('UserPreferencesService', () => {
	let repository: jest.Mocked<IUserPreferencesRepository>;
	let service: UserPreferencesService;
	let storedReader: PreferenceSection;

	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(
			new Date('2026-11-14T12:00:00.000Z'),
		);
		storedReader = PreferenceSection.restore({
			data: { fontSize: 18 },
			updatedAt: STORED_AT,
		});
		repository = {
			find: jest.fn(),
			updateSection: jest.fn(
				async (_userId, _name, resolve: PreferenceSectionResolver) =>
					resolve(storedReader),
			),
		};
		service = new UserPreferencesService(repository);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('getPreferences', () => {
		it('returns all allow-listed sections of the user', async () => {
			// Arrange
			repository.find.mockResolvedValue(
				UserPreferences.fromDocument({
					reader: { data: { fontSize: 18 }, updatedAt: STORED_AT },
				}),
			);

			// Act
			const result = await service.getPreferences(USER_ID);

			// Assert
			expect(result).toEqual({
				reader: { data: { fontSize: 18 }, updatedAt: STORED_AT },
			});
		});

		it('fails as not found when the user no longer exists', async () => {
			// Arrange
			repository.find.mockResolvedValue(null);

			// Act
			const result = service.getPreferences(USER_ID);

			// Assert
			await expect(result).rejects.toThrow(ResourceNotFoundException);
		});
	});

	describe('getSection', () => {
		it('returns nulls for a section the user never saved, so the app pushes its local copy', async () => {
			// Arrange
			repository.find.mockResolvedValue(UserPreferences.fromDocument({}));

			// Act
			const result = await service.getSection(USER_ID, 'reader');

			// Assert
			expect(result).toEqual({ data: null, updatedAt: null });
		});

		it('rejects an unknown section before touching storage', async () => {
			// Act
			const result = service.getSection(USER_ID, 'unknown');

			// Assert
			await expect(result).rejects.toThrow(ResourceNotFoundException);
			expect(repository.find).not.toHaveBeenCalled();
		});
	});

	describe('putSection', () => {
		it('stores and returns a newer write', async () => {
			// Act
			const result = await service.putSection(
				USER_ID,
				'reader',
				{ fontSize: 22 },
				new Date('2026-11-14T11:59:00.000Z'),
			);

			// Assert
			expect(result).toEqual({
				data: { fontSize: 22 },
				updatedAt: '2026-11-14T11:59:00.000Z',
			});
			const [userId, name] = repository.updateSection.mock.calls[0];
			expect(userId.toString()).toBe(USER_ID);
			expect(name.toString()).toBe('reader');
		});

		it('returns the stored section when the write is older, so the app adopts the server copy', async () => {
			// Act
			const result = await service.putSection(
				USER_ID,
				'reader',
				{ fontSize: 22 },
				new Date('2026-11-14T10:00:00.000Z'),
			);

			// Assert
			expect(result).toEqual({
				data: { fontSize: 18 },
				updatedAt: STORED_AT,
			});
		});

		it('rejects a timestamp more than five minutes ahead of the server clock', async () => {
			// Act
			const result = service.putSection(
				USER_ID,
				'reader',
				{ fontSize: 22 },
				new Date('2026-11-14T12:05:00.001Z'),
			);

			// Assert
			await expect(result).rejects.toThrow(DomainException);
			expect(repository.updateSection).not.toHaveBeenCalled();
		});

		it('rejects an unknown section', async () => {
			// Act
			const result = service.putSection(
				USER_ID,
				'unknown',
				{},
				new Date('2026-11-14T11:00:00.000Z'),
			);

			// Assert
			await expect(result).rejects.toThrow(ResourceNotFoundException);
			expect(repository.updateSection).not.toHaveBeenCalled();
		});

		it('fails as not found when the user no longer exists', async () => {
			// Arrange
			repository.updateSection.mockResolvedValue(null);

			// Act
			const result = service.putSection(
				USER_ID,
				'reader',
				{},
				new Date('2026-11-14T11:59:00.000Z'),
			);

			// Assert
			await expect(result).rejects.toThrow(ResourceNotFoundException);
		});
	});
});
