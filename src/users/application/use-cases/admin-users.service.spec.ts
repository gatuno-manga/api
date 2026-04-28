import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUsersService } from './admin-users.service';
import { User } from '../../infrastructure/database/entities/user.entity';
import { Role } from '../../infrastructure/database/entities/role.entity';
import { UserGroup } from '../../infrastructure/database/entities/user-group.entity';
import { AccessPolicy } from '../../infrastructure/database/entities/access-policy.entity';
import { AccessPolicyEffectEnum } from '../../domain/enums/access-policy-effect.enum';
import { AccessPolicyScopeEnum } from '../../domain/enums/access-policy-scope.enum';

describe('AdminUsersService', () => {
	let service: AdminUsersService;
	let userRepository: jest.Mocked<Repository<User>>;
	let roleRepository: jest.Mocked<Repository<Role>>;
	let userGroupRepository: jest.Mocked<Repository<UserGroup>>;
	let accessPolicyRepository: jest.Mocked<Repository<AccessPolicy>>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AdminUsersService,
				{
					provide: getRepositoryToken(User),
					useValue: {
						find: jest.fn(),
						findOne: jest.fn(),
						create: jest.fn(),
						save: jest.fn(),
						merge: jest.fn(),
					},
				},
				{
					provide: getRepositoryToken(Role),
					useValue: {
						find: jest.fn(),
						findOne: jest.fn(),
						create: jest.fn(),
						save: jest.fn(),
					},
				},
				{
					provide: getRepositoryToken(UserGroup),
					useValue: {
						find: jest.fn(),
						findOne: jest.fn(),
						create: jest.fn(),
						save: jest.fn(),
					},
				},
				{
					provide: getRepositoryToken(AccessPolicy),
					useValue: {
						find: jest.fn(),
						findOne: jest.fn(),
						create: jest.fn(),
						save: jest.fn(),
						createQueryBuilder: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<AdminUsersService>(AdminUsersService);
		userRepository = module.get(getRepositoryToken(User));
		roleRepository = module.get(getRepositoryToken(Role));
		userGroupRepository = module.get(getRepositoryToken(UserGroup));
		accessPolicyRepository = module.get(getRepositoryToken(AccessPolicy));
	});

	describe('evaluateAccessForBook', () => {
		it('blocks access when explicit deny book policy exists', async () => {
			userRepository.findOne.mockResolvedValue({
				id: 'u1',
				groups: [],
			} as any);

			const qb = {
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([
					{
						targetUserId: 'u1',
						effect: AccessPolicyEffectEnum.DENY,
						scope: AccessPolicyScopeEnum.BOOK,
						bookId: 'b1',
					},
				]),
			};

			accessPolicyRepository.createQueryBuilder.mockReturnValue(
				qb as any,
			);

			const result = await service.evaluateAccessForBook({
				userId: 'u1',
				bookId: 'b1',
				bookTagIds: [],
				bookSensitiveContentIds: [],
				bookSensitiveContentWeights: [],
				baseMaxWeightSensitiveContent: 4,
			});

			expect(result.blocked).toBe(true);
		});

		it('elevates max weight when matching allow tag policy exists', async () => {
			userRepository.findOne.mockResolvedValue({
				id: 'u1',
				groups: [],
			} as any);

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

			accessPolicyRepository.createQueryBuilder.mockReturnValue(
				qb as any,
			);

			const result = await service.evaluateAccessForBook({
				userId: 'u1',
				bookId: 'b1',
				bookTagIds: ['t1'],
				bookSensitiveContentIds: [],
				bookSensitiveContentWeights: [],
				baseMaxWeightSensitiveContent: 4,
			});

			expect(result.blocked).toBe(false);
			expect(result.effectiveMaxWeightSensitiveContent).toBe(60);
		});

		it('blocks access when book sensitive weight exceeds user max weight', async () => {
			userRepository.findOne.mockResolvedValue({
				id: 'u1',
				groups: [],
			} as any);
			accessPolicyRepository.createQueryBuilder.mockReturnValue({
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([]),
			} as any);

			const result = await service.evaluateAccessForBook({
				userId: 'u1',
				bookId: 'b1',
				bookTagIds: [],
				bookSensitiveContentIds: ['sc1'],
				bookSensitiveContentWeights: [10],
				baseMaxWeightSensitiveContent: 4,
			});

			expect(result.blocked).toBe(true);
		});
	});
});
