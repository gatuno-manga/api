import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccessPolicy } from './entities/access-policy.entity';
import { Role } from './entities/role.entity';
import { UserGroup } from './entities/user-group.entity';
import { User } from './entities/user.entity';
import { AdminUsersService } from './admin-users.service';
import { AccessPolicyEffectEnum } from './enum/access-policy-effect.enum';
import { AccessPolicyScopeEnum } from './enum/access-policy-scope.enum';

describe('AdminUsersService', () => {
	let service: AdminUsersService;
	let userRepository: any;
	let roleRepository: any;
	let accessPolicyRepository: any;

	const mockUserRepository = {
		findOne: jest.fn(),
		find: jest.fn(),
		save: jest.fn(),
		remove: jest.fn(),
		createQueryBuilder: jest.fn(),
	};

	const mockRoleRepository = {
		findOne: jest.fn(),
		find: jest.fn(),
		save: jest.fn(),
		create: jest.fn(),
	};

	const mockGroupRepository = {
		findOne: jest.fn(),
		find: jest.fn(),
		save: jest.fn(),
		remove: jest.fn(),
		create: jest.fn(),
	};

	const mockAccessPolicyRepository = {
		findOne: jest.fn(),
		find: jest.fn(),
		save: jest.fn(),
		remove: jest.fn(),
		create: jest.fn(),
		createQueryBuilder: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AdminUsersService,
				{
					provide: getRepositoryToken(User),
					useValue: mockUserRepository,
				},
				{
					provide: getRepositoryToken(Role),
					useValue: mockRoleRepository,
				},
				{
					provide: getRepositoryToken(UserGroup),
					useValue: mockGroupRepository,
				},
				{
					provide: getRepositoryToken(AccessPolicy),
					useValue: mockAccessPolicyRepository,
				},
			],
		}).compile();

		service = module.get<AdminUsersService>(AdminUsersService);
		userRepository = module.get(getRepositoryToken(User));
		roleRepository = module.get(getRepositoryToken(Role));
		accessPolicyRepository = module.get(getRepositoryToken(AccessPolicy));

		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('denies access when a matching deny policy exists even with allow policy', async () => {
		userRepository.findOne.mockResolvedValue({ id: 'u1', groups: [] });

		const qb = {
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getMany: jest.fn().mockResolvedValue([
				{
					targetUserId: 'u1',
					effect: AccessPolicyEffectEnum.ALLOW,
					scope: AccessPolicyScopeEnum.GLOBAL,
					overrideMaxWeightSensitiveContent: 99,
				},
				{
					targetUserId: 'u1',
					effect: AccessPolicyEffectEnum.DENY,
					scope: AccessPolicyScopeEnum.BOOK,
					bookId: 'b1',
				},
			]),
		};

		accessPolicyRepository.createQueryBuilder.mockReturnValue(qb);

		const result = await service.evaluateAccessForBook({
			userId: 'u1',
			bookId: 'b1',
			bookTagIds: [],
			bookSensitiveContentIds: [],
			baseMaxWeightSensitiveContent: 4,
		});

		expect(result.blocked).toBe(true);
	});

	it('elevates max weight when matching allow tag policy exists', async () => {
		userRepository.findOne.mockResolvedValue({ id: 'u1', groups: [] });

		const qb = {
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getMany: jest.fn().mockResolvedValue([
				{
					targetUserId: 'u1',
					effect: AccessPolicyEffectEnum.ALLOW,
					scope: AccessPolicyScopeEnum.TAG,
					tagId: 't1',
					overrideMaxWeightSensitiveContent: 60,
				},
			]),
		};

		accessPolicyRepository.createQueryBuilder.mockReturnValue(qb);

		const result = await service.evaluateAccessForBook({
			userId: 'u1',
			bookId: 'b1',
			bookTagIds: ['t1'],
			bookSensitiveContentIds: [],
			baseMaxWeightSensitiveContent: 4,
		});

		expect(result.blocked).toBe(false);
		expect(result.effectiveMaxWeightSensitiveContent).toBe(60);
	});

	it('prioritizes user allow over group deny for the same book', async () => {
		userRepository.findOne.mockResolvedValue({
			id: 'u1',
			groups: [{ id: 'g1' }],
		});

		const qb = {
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getMany: jest.fn().mockResolvedValue([
				{
					targetGroupId: 'g1',
					effect: AccessPolicyEffectEnum.DENY,
					scope: AccessPolicyScopeEnum.BOOK,
					bookId: 'b1',
				},
				{
					targetUserId: 'u1',
					effect: AccessPolicyEffectEnum.ALLOW,
					scope: AccessPolicyScopeEnum.BOOK,
					bookId: 'b1',
					overrideMaxWeightSensitiveContent: 70,
				},
			]),
		};

		accessPolicyRepository.createQueryBuilder.mockReturnValue(qb);

		const result = await service.evaluateAccessForBook({
			userId: 'u1',
			bookId: 'b1',
			bookTagIds: [],
			bookSensitiveContentIds: [],
			baseMaxWeightSensitiveContent: 4,
		});

		expect(result.blocked).toBe(false);
		expect(result.effectiveMaxWeightSensitiveContent).toBe(70);
	});

	it('prioritizes user global allow over group global deny', async () => {
		userRepository.findOne.mockResolvedValue({
			id: 'u1',
			groups: [{ id: 'g1' }],
		});

		const qb = {
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getMany: jest.fn().mockResolvedValue([
				{
					targetGroupId: 'g1',
					effect: AccessPolicyEffectEnum.DENY,
					scope: AccessPolicyScopeEnum.GLOBAL,
				},
				{
					targetUserId: 'u1',
					effect: AccessPolicyEffectEnum.ALLOW,
					scope: AccessPolicyScopeEnum.GLOBAL,
					overrideMaxWeightSensitiveContent: 80,
				},
			]),
		};

		accessPolicyRepository.createQueryBuilder.mockReturnValue(qb);

		const result = await service.evaluateAccessForBook({
			userId: 'u1',
			bookId: 'b2',
			bookTagIds: [],
			bookSensitiveContentIds: [],
			baseMaxWeightSensitiveContent: 4,
		});

		expect(result.blocked).toBe(false);
		expect(result.effectiveMaxWeightSensitiveContent).toBe(80);
	});

	it('denies access when sensitive content deny policy matches the book', async () => {
		userRepository.findOne.mockResolvedValue({ id: 'u1', groups: [] });

		const qb = {
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getMany: jest.fn().mockResolvedValue([
				{
					targetUserId: 'u1',
					effect: AccessPolicyEffectEnum.DENY,
					scope: AccessPolicyScopeEnum.SENSITIVE_CONTENT,
					sensitiveContentId: 'sc1',
				},
			]),
		};

		accessPolicyRepository.createQueryBuilder.mockReturnValue(qb);

		const result = await service.evaluateAccessForBook({
			userId: 'u1',
			bookId: 'b5',
			bookTagIds: [],
			bookSensitiveContentIds: ['sc1'],
			baseMaxWeightSensitiveContent: 4,
		});

		expect(result.blocked).toBe(true);
	});

	it('blocks self role update when admin role is removed from own account', async () => {
		const targetUser = {
			id: 'admin-1',
			roles: [{ name: 'admin' }],
		};

		jest.spyOn(service, 'getUserById').mockResolvedValue(targetUser as any);
		roleRepository.find.mockResolvedValue([{ id: 'r-user', name: 'user' }]);

		await expect(
			service.updateUserRoles('admin-1', { roles: ['user'] }, 'admin-1'),
		).rejects.toThrow('You cannot remove your own admin role');
	});
});
