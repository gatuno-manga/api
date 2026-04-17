import type { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';
import { UserBuilder } from './user.builder';

describe('UserBuilder', () => {
	let builder: UserBuilder;

	beforeEach(() => {
		builder = new UserBuilder();
	});

	describe('construção básica', () => {
		it('deve criar um usuário com campos obrigatórios', () => {
			const user = builder
				.withUserName('johndoe')
				.withEmail('john@example.com')
				.withPassword('hashedPassword123')
				.build();

			expect(user).toBeInstanceOf(User);
			expect(user.userName).toBe('johndoe');
			expect(user.email).toBe('john@example.com');
			expect(user.password).toBe('hashedPassword123');
			expect(user.roles).toEqual([]);
			expect(user.maxWeightSensitiveContent).toBe(0);
		});

		it('deve criar um usuário com todos os campos', () => {
			const now = new Date();
			const role: Role = {
				id: '1',
				name: 'USER',
				maxWeightSensitiveContent: 5,
			};

			const user = builder
				.withId('user-uuid-123')
				.withUserName('johndoe')
				.withName('John Doe')
				.withEmail('john@example.com')
				.withPassword('hashedPassword123')
				.withMaxWeightSensitiveContent(5)
				.withRoles([role])
				.withCreatedAt(now)
				.withUpdatedAt(now)
				.build();

			expect(user.id).toBe('user-uuid-123');
			expect(user.userName).toBe('johndoe');
			expect(user.name).toBe('John Doe');
			expect(user.email).toBe('john@example.com');
			expect(user.password).toBe('hashedPassword123');
			expect(user.maxWeightSensitiveContent).toBe(5);
			expect(user.roles).toEqual([role]);
			expect(user.createdAt).toBe(now);
			expect(user.updatedAt).toBe(now);
		});

		it('deve permitir construção fluente', () => {
			const user = builder
				.withUserName('user1')
				.withEmail('user1@example.com')
				.withPassword('pass')
				.withName('User One')
				.withMaxWeightSensitiveContent(3)
				.build();

			expect(user.userName).toBe('user1');
			expect(user.email).toBe('user1@example.com');
			expect(user.name).toBe('User One');
		});
	});

	describe('gerenciamento de roles', () => {
		it('deve adicionar roles como array', () => {
			const role1: Role = {
				id: '1',
				name: 'USER',
				maxWeightSensitiveContent: 0,
			};
			const role2: Role = {
				id: '2',
				name: 'ADMIN',
				maxWeightSensitiveContent: 10,
			};

			const user = builder
				.withUserName('user')
				.withEmail('user@example.com')
				.withPassword('pass')
				.withRoles([role1, role2])
				.build();

			expect(user.roles).toHaveLength(2);
			expect(user.roles).toContain(role1);
			expect(user.roles).toContain(role2);
		});

		it('deve adicionar role individualmente', () => {
			const role1: Role = {
				id: '1',
				name: 'USER',
				maxWeightSensitiveContent: 0,
			};
			const role2: Role = {
				id: '2',
				name: 'MODERATOR',
				maxWeightSensitiveContent: 5,
			};

			const user = builder
				.withUserName('user')
				.withEmail('user@example.com')
				.withPassword('pass')
				.addRole(role1)
				.addRole(role2)
				.build();

			expect(user.roles).toHaveLength(2);
			expect(user.roles).toContain(role1);
			expect(user.roles).toContain(role2);
		});

		it('deve permitir combinar withRoles e addRole', () => {
			const role1: Role = {
				id: '1',
				name: 'USER',
				maxWeightSensitiveContent: 0,
			};
			const role2: Role = {
				id: '2',
				name: 'MODERATOR',
				maxWeightSensitiveContent: 5,
			};
			const role3: Role = {
				id: '3',
				name: 'ADMIN',
				maxWeightSensitiveContent: 10,
			};

			const user = builder
				.withUserName('user')
				.withEmail('user@example.com')
				.withPassword('pass')
				.withRoles([role1, role2])
				.addRole(role3)
				.build();

			expect(user.roles).toHaveLength(3);
		});
	});

	describe('métodos de conveniência', () => {
		it('deve criar usuário com valores padrão', () => {
			const user = builder.withDefaults().build();

			expect(user.userName).toBe('testuser');
			expect(user.name).toBe('Test User');
			expect(user.email).toBe('test@example.com');
			expect(user.password).toBe('hashedPassword123');
			expect(user.maxWeightSensitiveContent).toBe(0);
			expect(user.roles).toEqual([]);
		});

		it('deve permitir sobrescrever valores padrão', () => {
			const user = builder
				.withDefaults()
				.withEmail('custom@example.com')
				.withMaxWeightSensitiveContent(7)
				.build();

			expect(user.email).toBe('custom@example.com');
			expect(user.maxWeightSensitiveContent).toBe(7);
			expect(user.userName).toBe('testuser'); // mantém o padrão
		});

		it('deve criar usuário admin com valores padrão', () => {
			const user = builder.withAdminDefaults().build();

			expect(user.userName).toBe('admin');
			expect(user.name).toBe('Administrator');
			expect(user.email).toBe('admin@example.com');
			expect(user.maxWeightSensitiveContent).toBe(10);
		});

		it('deve criar usuário admin com role fornecida', () => {
			const adminRole: Role = {
				id: '1',
				name: 'ADMIN',
				maxWeightSensitiveContent: 10,
			};
			const user = builder.withAdminDefaults(adminRole).build();

			expect(user.roles).toHaveLength(1);
			expect(user.roles[0]).toBe(adminRole);
		});

		it('deve criar usuário com dados aleatórios', () => {
			const user = builder.withRandomData().build();

			expect(user.userName).toMatch(/^user_/);
			expect(user.email).toMatch(/^user_.*@example\.com$/);
			expect(user.password).toMatch(/^hashedPassword_/);
			expect(user.maxWeightSensitiveContent).toBeGreaterThanOrEqual(0);
			expect(user.maxWeightSensitiveContent).toBeLessThanOrEqual(10);
		});

		it('deve criar usuário com dados aleatórios usando sufixo customizado', () => {
			const user = builder.withRandomData('test123').build();

			expect(user.userName).toBe('user_test123');
			expect(user.email).toBe('user_test123@example.com');
			expect(user.password).toBe('hashedPassword_test123');
		});

		it('deve gerar dados aleatórios únicos sem sufixo', () => {
			const user1 = builder.withRandomData().build();
			builder.reset();
			const user2 = new UserBuilder().withRandomData().build();

			expect(user1.email).not.toBe(user2.email);
			expect(user1.userName).not.toBe(user2.userName);
		});
	});

	describe('validações', () => {
		it('deve lançar erro se email não for fornecido', () => {
			expect(() => {
				builder.withUserName('user').withPassword('pass').build();
			}).toThrow('UserBuilder: email é obrigatório');
		});

		it('deve lançar erro se userName não for fornecido', () => {
			expect(() => {
				builder
					.withEmail('user@example.com')
					.withPassword('pass')
					.build();
			}).toThrow('UserBuilder: userName é obrigatório');
		});

		it('deve lançar erro se password não for fornecido', () => {
			expect(() => {
				builder
					.withUserName('user')
					.withEmail('user@example.com')
					.build();
			}).toThrow('UserBuilder: password é obrigatório');
		});

		it('não deve lançar erro ao usar buildUnsafe sem campos obrigatórios', () => {
			const user = builder.buildUnsafe();

			expect(user).toBeInstanceOf(User);
			expect(user.email).toBeUndefined();
			expect(user.userName).toBeUndefined();
		});
	});

	describe('reset e reutilização', () => {
		it('deve resetar o builder para estado inicial', () => {
			builder
				.withUserName('user1')
				.withEmail('user1@example.com')
				.withPassword('pass1')
				.withMaxWeightSensitiveContent(5);

			builder.reset();

			const user = builder
				.withUserName('user2')
				.withEmail('user2@example.com')
				.withPassword('pass2')
				.build();

			expect(user.userName).toBe('user2');
			expect(user.email).toBe('user2@example.com');
			expect(user.maxWeightSensitiveContent).toBe(0);
		});

		it('deve permitir construir múltiplos usuários com reset', () => {
			const user1 = builder
				.withDefaults()
				.withEmail('user1@example.com')
				.build();

			builder.reset();

			const user2 = builder
				.withDefaults()
				.withEmail('user2@example.com')
				.build();

			expect(user1.email).toBe('user1@example.com');
			expect(user2.email).toBe('user2@example.com');
		});
	});

	describe('cenários de uso real', () => {
		it('deve criar usuário para seed de banco de dados', () => {
			const adminRole: Role = {
				id: '1',
				name: 'ADMIN',
				maxWeightSensitiveContent: 10,
			};
			const userRole: Role = {
				id: '2',
				name: 'USER',
				maxWeightSensitiveContent: 0,
			};

			const admin = builder
				.withUserName('admin')
				.withName('System Administrator')
				.withEmail('admin@system.com')
				.withPassword('$2b$10$hashedPassword')
				.withMaxWeightSensitiveContent(10)
				.withRoles([adminRole])
				.build();

			expect(admin.roles).toContain(adminRole);
			expect(admin.maxWeightSensitiveContent).toBe(10);
		});

		it('deve criar múltiplos usuários para testes', () => {
			const users: User[] = [];

			for (let i = 0; i < 5; i++) {
				const user = new UserBuilder()
					.withRandomData(`test${i}`)
					.build();
				users.push(user);
			}

			expect(users).toHaveLength(5);
			expect(new Set(users.map((u) => u.email)).size).toBe(5); // todos únicos
		});

		it('deve criar usuário para teste de autenticação', () => {
			const testUser = builder
				.withUserName('testauth')
				.withEmail('auth@test.com')
				.withPassword('$2b$10$KnownHashForTesting')
				.withMaxWeightSensitiveContent(0)
				.build();

			expect(testUser.password).toBe('$2b$10$KnownHashForTesting');
			expect(testUser.email).toBe('auth@test.com');
		});
	});
});
