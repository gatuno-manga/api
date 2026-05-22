import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserResourcesMapper } from '@users/application/mappers/user-resources.mapper';
import { Role } from '@users/infrastructure/database/entities/role.entity';
import { UserImage } from '@users/infrastructure/database/entities/user-image.entity';
import { User } from '@users/infrastructure/database/entities/user.entity';
import { FilesService } from 'src/files/application/services/files.service';
import { DataSource } from 'typeorm';
import { UsersService } from './users.service';

describe('UsersService', () => {
	let service: UsersService;
	let userRepository: any;
	let roleRepository: any;

	const mockUserRepository = {
		findOne: jest.fn(),
		find: jest.fn(),
		save: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
		merge: jest.fn(),
	};

	const mockRoleRepository = {
		findOne: jest.fn(),
		find: jest.fn(),
		save: jest.fn(),
		create: jest.fn(),
		manager: {
			query: jest.fn(),
		},
	};

	const mockUserImageRepository = {
		findOne: jest.fn(),
		save: jest.fn(),
		create: jest.fn(),
		delete: jest.fn(),
	};

	const mockDataSource = {
		query: jest.fn(),
		createQueryRunner: jest.fn(() => ({
			connect: jest.fn(),
			startTransaction: jest.fn(),
			commitTransaction: jest.fn(),
			rollbackTransaction: jest.fn(),
			release: jest.fn(),
		})),
	};

	const mockFilesService = {
		saveBufferFile: jest.fn(),
		deleteFile: jest.fn(),
	};

	const mockUserResourcesMapper = {
		toUserProfile: jest.fn(),
		toPublicUserProfile: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				UsersService,
				{
					provide: getRepositoryToken(User),
					useValue: mockUserRepository,
				},
				{
					provide: getRepositoryToken(Role),
					useValue: mockRoleRepository,
				},
				{
					provide: getRepositoryToken(UserImage),
					useValue: mockUserImageRepository,
				},
				{
					provide: DataSource,
					useValue: mockDataSource,
				},
				{
					provide: FilesService,
					useValue: mockFilesService,
				},
				{
					provide: UserResourcesMapper,
					useValue: mockUserResourcesMapper,
				},
			],
		}).compile();

		service = module.get<UsersService>(UsersService);
		userRepository = module.get(getRepositoryToken(User));
		roleRepository = module.get(getRepositoryToken(Role));

		// Mock onApplicationBootstrap to avoid database operations
		jest.spyOn(service, 'onApplicationBootstrap').mockResolvedValue(
			undefined,
		);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('should have userRepository injected', () => {
		expect(userRepository).toBeDefined();
	});

	it('should update user preferences successfully', async () => {
		const userId = 'user-1';
		const updateDto = { preferences: { theme: 'dark', language: 'pt' } };
		const existingUser = { id: userId, userName: 'john' } as User;
		const updatedUser = { ...existingUser, ...updateDto } as User;

		mockUserRepository.findOne.mockResolvedValue(existingUser);
		mockUserRepository.save.mockResolvedValue(updatedUser);

		// Repository.merge mock (manual simulation for the test)
		jest.spyOn(userRepository, 'merge').mockImplementation(
			(entity: any, dto: any) => ({ ...entity, ...dto }) as any,
		);

		const result = await service.updateUser(updateDto as any, userId);

		expect(userRepository.findOne).toHaveBeenCalledWith({
			where: { id: userId },
		});
		expect(userRepository.save).toHaveBeenCalled();
		expect(result.preferences).toEqual(updateDto.preferences);
	});
});
