import { Repository } from 'typeorm';
import { Role } from 'src/users/infrastructure/database/entities/role.entity';
import { User } from 'src/users/infrastructure/database/entities/user.entity';
import { EmailVO } from '../../domain/value-objects/email.vo';
import { TypeOrmUserRepositoryAdapter } from './typeorm-user-repository.adapter';

describe('TypeOrmUserRepositoryAdapter', () => {
	let adapter: TypeOrmUserRepositoryAdapter;
	let userRepository: jest.Mocked<Repository<User>>;
	let roleRepository: jest.Mocked<Repository<Role>>;

	beforeEach(() => {
		userRepository = {
			findOne: jest.fn(),
			save: jest.fn(),
			create: jest.fn(),
			createQueryBuilder: jest.fn(),
		} as unknown as jest.Mocked<Repository<User>>;

		roleRepository = {
			findOne: jest.fn(),
		} as unknown as jest.Mocked<Repository<Role>>;

		adapter = new TypeOrmUserRepositoryAdapter(
			userRepository,
			roleRepository,
		);
	});

	it('deve buscar credenciais com password selecionada explicitamente', async () => {
		const user = {
			id: 'user-1',
			email: 'user@example.com',
			password: 'hashed-password',
			userName: 'user',
			roles: [{ name: 'user' }],
		} as User;
		const queryBuilder = {
			leftJoinAndSelect: jest.fn().mockReturnThis(),
			addSelect: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			getOne: jest.fn().mockResolvedValue(user),
		};

		userRepository.createQueryBuilder.mockReturnValue(
			queryBuilder as unknown as ReturnType<
				Repository<User>['createQueryBuilder']
			>,
		);

		const result = await adapter.findCredentialsByEmail(
			new EmailVO('user@example.com'),
		);

		expect(userRepository.createQueryBuilder).toHaveBeenCalledWith('user');
		expect(queryBuilder.addSelect).toHaveBeenCalledWith('user.password');
		expect(queryBuilder.where).toHaveBeenCalledWith('user.email = :email', {
			email: 'user@example.com',
		});
		expect(result).toEqual({
			id: 'user-1',
			email: 'user@example.com',
			password: 'hashed-password',
			userName: 'user',
			roles: [{ name: 'user' }],
		});
	});
});
