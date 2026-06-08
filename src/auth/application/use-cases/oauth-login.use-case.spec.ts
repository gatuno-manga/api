import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import { Role } from 'src/users/infrastructure/database/entities/role.entity';
import { User } from 'src/users/infrastructure/database/entities/user.entity';
import { Repository } from 'typeorm';
import { OAuthLoginUseCase } from './oauth-login.use-case';

jest.mock('uuid', () => ({
	v7: jest.fn(() => '1234567-89ab-cdef'),
}));

describe('OAuthLoginUseCase', () => {
	let useCase: OAuthLoginUseCase;
	let userRepository: jest.Mocked<Repository<User>>;
	let roleRepository: jest.Mocked<Repository<Role>>;

	beforeEach(async () => {
		const mockUserRepository = {
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
		};

		const mockRoleRepository = {
			findOne: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				OAuthLoginUseCase,
				{
					provide: getRepositoryToken(User),
					useValue: mockUserRepository,
				},
				{
					provide: getRepositoryToken(Role),
					useValue: mockRoleRepository,
				},
			],
		}).compile();

		useCase = module.get<OAuthLoginUseCase>(OAuthLoginUseCase);
		userRepository = module.get(getRepositoryToken(User));
		roleRepository = module.get(getRepositoryToken(Role));
	});

	it('should return user if providerId is already linked', async () => {
		const user = { id: 'user-id', email: 'test@example.com' } as User;
		userRepository.findOne.mockResolvedValue(user);

		const result = await useCase.execute(
			'google',
			'google-123',
			'test@example.com',
		);

		expect(userRepository.findOne).toHaveBeenCalledWith({
			where: { googleId: 'google-123' },
			relations: ['roles', 'roles.permissions'],
		});
		expect(result).toEqual(user);
	});

	it('should link providerId and return user if email exists but provider is not linked', async () => {
		const user = { id: 'user-id', email: 'test@example.com' } as User;
		userRepository.findOne
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(user);
		userRepository.save.mockResolvedValue(user);

		const result = await useCase.execute(
			'discord',
			'discord-123',
			'test@example.com',
		);

		expect(user.discordId).toBe('discord-123');
		expect(userRepository.save).toHaveBeenCalledWith(user);
		expect(result).toEqual(user);
	});

	it('should create new user and link providerId if neither exists', async () => {
		const defaultRole = { id: 'role-id', name: RolesEnum.USER } as Role;
		const createdUser = {
			email: 'test@example.com',
			roles: [defaultRole],
		} as User;
		const savedUser = {
			...createdUser,
			id: 'user-id',
			githubId: 'github-123',
		} as User;

		userRepository.findOne.mockResolvedValue(null);
		roleRepository.findOne.mockResolvedValue(defaultRole);
		userRepository.create.mockReturnValue(createdUser);
		userRepository.save.mockResolvedValue(savedUser);

		const result = await useCase.execute(
			'github',
			'github-123',
			'test@example.com',
			'Test User',
		);

		expect(userRepository.create).toHaveBeenCalledWith(
			expect.objectContaining({
				email: 'test@example.com',
				name: 'Test User',
				password: null,
				roles: [defaultRole],
				userName: 'test-12345',
			}),
		);
		expect(createdUser.githubId).toBe('github-123');
		expect(userRepository.save).toHaveBeenCalledWith(createdUser);
		expect(result).toEqual(savedUser);
	});

	it('should link providerId to existingUserId if provided and ignore email', async () => {
		const loggedInUser = {
			id: 'existing-id',
			email: 'old@example.com',
		} as User;
		userRepository.findOne.mockResolvedValue(loggedInUser);
		userRepository.save.mockResolvedValue(loggedInUser);

		const result = await useCase.execute(
			'google',
			'google-999',
			'new@example.com',
			'Test User',
			'existing-id',
		);

		expect(userRepository.findOne).toHaveBeenCalledWith({
			where: { id: 'existing-id' },
			relations: ['roles', 'roles.permissions'],
		});
		expect(loggedInUser.googleId).toBe('google-999');
		expect(userRepository.save).toHaveBeenCalledWith(loggedInUser);
		expect(result).toEqual(loggedInUser);
	});
});
