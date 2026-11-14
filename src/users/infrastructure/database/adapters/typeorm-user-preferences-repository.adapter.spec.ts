import { UserId } from '@common/domain/value-objects/user-id.vo';
import { PreferenceSectionName } from '@users/domain/value-objects/preference-section-name.vo';
import { PreferenceSection } from '@users/domain/value-objects/preference-section.vo';
import { User } from '@users/infrastructure/database/entities/user.entity';
import { Repository } from 'typeorm';
import { TypeOrmUserPreferencesRepositoryAdapter } from './typeorm-user-preferences-repository.adapter';

const USER_ID = UserId.create('0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b');
const READER = PreferenceSectionName.create('reader');
const STORED_READER = {
	data: { fontSize: 18 },
	updatedAt: '2026-11-14T11:00:00.000Z',
};

describe('TypeOrmUserPreferencesRepositoryAdapter', () => {
	let lockedUser: Partial<User> | null;
	let queryBuilder: Record<string, jest.Mock>;
	let transactionalRepository: {
		createQueryBuilder: jest.Mock;
		update: jest.Mock;
	};
	let repository: { findOne: jest.Mock; manager: { transaction: jest.Mock } };
	let adapter: TypeOrmUserPreferencesRepositoryAdapter;

	beforeEach(() => {
		lockedUser = {
			id: USER_ID.toString(),
			preferences: { theme: 'dark', reader: STORED_READER },
		};
		queryBuilder = {
			select: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			setLock: jest.fn().mockReturnThis(),
			getOne: jest.fn(async () => lockedUser),
		};
		transactionalRepository = {
			createQueryBuilder: jest.fn(() => queryBuilder),
			update: jest.fn(),
		};
		const manager = {
			getRepository: jest.fn(() => transactionalRepository),
		};
		repository = {
			findOne: jest.fn(),
			manager: {
				transaction: jest.fn(async (work) => work(manager)),
			},
		};
		adapter = new TypeOrmUserPreferencesRepositoryAdapter(
			repository as unknown as Repository<User>,
		);
	});

	describe('find', () => {
		it('reads only the preferences column without eager relations', async () => {
			// Arrange
			repository.findOne.mockResolvedValue({
				preferences: { reader: STORED_READER },
			});

			// Act
			const preferences = await adapter.find(USER_ID);

			// Assert
			expect(preferences?.toSnapshot()).toEqual({
				reader: STORED_READER,
			});
			expect(repository.findOne).toHaveBeenCalledWith(
				expect.objectContaining({ loadEagerRelations: false }),
			);
		});

		it('returns null when the user does not exist', async () => {
			// Arrange
			repository.findOne.mockResolvedValue(null);

			// Act
			const preferences = await adapter.find(USER_ID);

			// Assert
			expect(preferences).toBeNull();
		});
	});

	describe('updateSection', () => {
		it('locks the user row so concurrent section writes cannot drop each other', async () => {
			// Act
			await adapter.updateSection(USER_ID, READER, (stored) => stored);

			// Assert
			expect(repository.manager.transaction).toHaveBeenCalled();
			expect(queryBuilder.setLock).toHaveBeenCalledWith(
				'pessimistic_write',
			);
		});

		it('writes the winner into its section and keeps every other key', async () => {
			// Arrange
			const incoming = PreferenceSection.write(
				{ fontSize: 22 },
				new Date('2026-11-14T11:30:00.000Z'),
				new Date('2026-11-14T12:00:00.000Z'),
			);

			// Act
			const winner = await adapter.updateSection(
				USER_ID,
				READER,
				() => incoming,
			);

			// Assert
			expect(winner).toBe(incoming);
			expect(transactionalRepository.update).toHaveBeenCalledWith(
				{ id: USER_ID.toString() },
				{
					preferences: {
						theme: 'dark',
						reader: {
							data: { fontSize: 22 },
							updatedAt: '2026-11-14T11:30:00.000Z',
						},
					},
				},
			);
		});

		it('skips the write when the stored section wins', async () => {
			// Act
			const winner = await adapter.updateSection(
				USER_ID,
				READER,
				(stored) => stored,
			);

			// Assert
			expect(winner?.toSnapshot()).toEqual(STORED_READER);
			expect(transactionalRepository.update).not.toHaveBeenCalled();
		});

		it('returns null when the user does not exist', async () => {
			// Arrange
			lockedUser = null;

			// Act
			const winner = await adapter.updateSection(
				USER_ID,
				READER,
				(stored) => stored,
			);

			// Assert
			expect(winner).toBeNull();
			expect(transactionalRepository.update).not.toHaveBeenCalled();
		});
	});
});
