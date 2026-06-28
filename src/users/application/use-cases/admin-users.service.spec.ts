import { MEILI_CLIENT } from '@/infrastructure/meilisearch/meilisearch.constants';
import { PasswordEncryption } from '@encryption/password-encryption.provider';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccessPolicyEffectEnum } from '@users/domain/enums/access-policy-effect.enum';
import { AccessPolicyScopeEnum } from '@users/domain/enums/access-policy-scope.enum';
import { AccessPolicy } from '@users/infrastructure/database/entities/access-policy.entity';
import { Permission } from '@users/infrastructure/database/entities/permission.entity';
import { Role } from '@users/infrastructure/database/entities/role.entity';
import { UserGroup } from '@users/infrastructure/database/entities/user-group.entity';
import { User } from '@users/infrastructure/database/entities/user.entity';
import { WebPushService } from '@users/infrastructure/web-push/web-push.service';
import { Repository } from 'typeorm';
import { UserPermissionsService } from '../services/user-permissions.service';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService', () => {
	let service: AdminUsersService;
	let userRepository: jest.Mocked<Repository<User>>;
	let _roleRepository: jest.Mocked<Repository<Role>>;
	let _userGroupRepository: jest.Mocked<Repository<UserGroup>>;
	let accessPolicyRepository: jest.Mocked<Repository<AccessPolicy>>;
	let meiliClient: any;

	beforeEach(async () => {
		meiliClient = {
			index: jest.fn().mockReturnValue({
				search: jest.fn(),
			}),
		};

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
				{
					provide: getRepositoryToken(Permission),
					useValue: {
						find: jest.fn(),
						findOne: jest.fn(),
						create: jest.fn(),
						save: jest.fn(),
					},
				},
				{
					provide: UserPermissionsService,
					useValue: {
						invalidateCache: jest.fn(),
						invalidateAllCache: jest.fn(),
					},
				},
				{
					provide: MEILI_CLIENT,
					useValue: meiliClient,
				},
				{
					provide: PasswordEncryption,
					useValue: {
						hash: jest.fn(),
						compare: jest.fn(),
					},
				},
				{
					provide: 'MQTT_CLIENT',
					useValue: {
						emit: jest.fn(),
					},
				},
				{
					provide: WebPushService,
					useValue: {
						notifyUser: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<AdminUsersService>(AdminUsersService);
		userRepository = module.get(getRepositoryToken(User));
		_roleRepository = module.get(getRepositoryToken(Role));
		_userGroupRepository = module.get(getRepositoryToken(UserGroup));
		accessPolicyRepository = module.get(getRepositoryToken(AccessPolicy));
	});

	describe('search', () => {
		it('should call meilisearch with the query', async () => {
			const query = 'admin';
			const mockHits = [{ id: '1', userName: 'admin' }];
			meiliClient
				.index('users')
				.search.mockResolvedValue({ hits: mockHits });

			const result = await service.search(query);

			expect(meiliClient.index).toHaveBeenCalledWith('users');
			expect(result).toEqual(mockHits);
		});

		it('should return empty array on error', async () => {
			meiliClient
				.index('users')
				.search.mockRejectedValue(new Error('Meili Error'));

			const result = await service.search('query');

			expect(result).toEqual([]);
		});
	});
});
