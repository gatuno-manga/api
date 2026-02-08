import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Role } from './entitys/role.entity';
import { User } from './entitys/user.entity';
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
					provide: DataSource,
					useValue: mockDataSource,
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
