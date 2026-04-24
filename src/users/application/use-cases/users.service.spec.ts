import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Role } from '../../infrastructure/database/entities/role.entity';
import { User } from '../../infrastructure/database/entities/user.entity';
import { UserImage } from '../../infrastructure/database/entities/user-image.entity';
import { UsersService } from './users.service';
import { FilesService } from 'src/files/application/services/files.service';
import { UserResourcesMapper } from '../mappers/user-resources.mapper';

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

	it('should have roleRepository injected', () => {
		expect(roleRepository).toBeDefined();
	});
});
