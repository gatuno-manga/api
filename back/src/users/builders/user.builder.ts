import { User } from '../entitys/user.entity';
import { Role } from '../entitys/role.entity';

/**
 * Builder Pattern para a entidade User
 *
 * Facilita a criação de instâncias de User de forma fluente e legível,
 * especialmente útil em testes e seeds onde múltiplos cenários precisam
 * ser criados com diferentes configurações.
 *
 * @example
 * // Uso básico
 * const user = new UserBuilder()
 *   .withUserName('johndoe')
 *   .withEmail('john@example.com')
 *   .withPassword('hashedPassword123')
 *   .build();
 *
 * @example
 * // Com roles e dados completos
 * const adminUser = new UserBuilder()
 *   .withUserName('admin')
 *   .withName('Admin User')
 *   .withEmail('admin@example.com')
 *   .withPassword('hashedPassword')
 *   .withMaxWeightSensitiveContent(10)
 *   .withRoles([adminRole, moderatorRole])
 *   .build();
 *
 * @example
 * // Para testes - usuário padrão
 * const testUser = new UserBuilder()
 *   .withDefaults()
 *   .withEmail('test@example.com')
 *   .build();
 */
export class UserBuilder {
    private user: User;

    constructor() {
        this.user = new User();
        // Valores padrão mínimos
        this.user.roles = [];
        this.user.maxWeightSensitiveContent = 0;
    }

    /**
     * Define o ID do usuário
     * @param id UUID do usuário
     */
    withId(id: string): this {
        this.user.id = id;
        return this;
    }

    /**
     * Define o nome de usuário (username)
     * @param userName Nome de usuário único
     */
    withUserName(userName: string): this {
        this.user.userName = userName;
        return this;
    }

    /**
     * Define o nome completo do usuário
     * @param name Nome completo
     */
    withName(name: string): this {
        this.user.name = name;
        return this;
    }

    /**
     * Define o email do usuário
     * @param email Email único do usuário
     */
    withEmail(email: string): this {
        this.user.email = email;
        return this;
    }

    /**
     * Define a senha (já hasheada) do usuário
     * @param password Senha hasheada
     */
    withPassword(password: string): this {
        this.user.password = password;
        return this;
    }

    /**
     * Define o peso máximo de conteúdo sensível permitido
     * @param maxWeight Peso máximo (0-10)
     */
    withMaxWeightSensitiveContent(maxWeight: number): this {
        this.user.maxWeightSensitiveContent = maxWeight;
        return this;
    }

    /**
     * Define as roles do usuário
     * @param roles Array de roles
     */
    withRoles(roles: Role[]): this {
        this.user.roles = roles;
        return this;
    }

    /**
     * Adiciona uma única role ao usuário
     * @param role Role a ser adicionada
     */
    addRole(role: Role): this {
        if (!this.user.roles) {
            this.user.roles = [];
        }
        this.user.roles.push(role);
        return this;
    }

    /**
     * Define a data de criação
     * @param date Data de criação
     */
    withCreatedAt(date: Date): this {
        this.user.createdAt = date;
        return this;
    }

    /**
     * Define a data de atualização
     * @param date Data de atualização
     */
    withUpdatedAt(date: Date): this {
        this.user.updatedAt = date;
        return this;
    }

    /**
     * Configura valores padrão para um usuário comum de teste
     * Útil para criar rapidamente usuários em testes
     */
    withDefaults(): this {
        this.user.userName = 'testuser';
        this.user.name = 'Test User';
        this.user.email = 'test@example.com';
        this.user.password = 'hashedPassword123';
        this.user.maxWeightSensitiveContent = 0;
        this.user.roles = [];
        return this;
    }

    /**
     * Configura um usuário admin com valores padrão
     * Útil para testes que requerem permissões administrativas
     */
    withAdminDefaults(adminRole?: Role): this {
        this.user.userName = 'admin';
        this.user.name = 'Administrator';
        this.user.email = 'admin@example.com';
        this.user.password = 'hashedAdminPassword';
        this.user.maxWeightSensitiveContent = 10;
        if (adminRole) {
            this.user.roles = [adminRole];
        }
        return this;
    }

    /**
     * Cria um usuário com dados aleatórios para testes
     * @param suffix Sufixo opcional para garantir unicidade
     */
    withRandomData(suffix?: string): this {
        const random = suffix || Math.random().toString(36).substring(7);
        this.user.userName = `user_${random}`;
        this.user.name = `User ${random}`;
        this.user.email = `user_${random}@example.com`;
        this.user.password = `hashedPassword_${random}`;
        this.user.maxWeightSensitiveContent = Math.floor(Math.random() * 11);
        return this;
    }

    /**
     * Reseta o builder para o estado inicial
     * Útil para reutilizar a mesma instância do builder
     */
    reset(): this {
        this.user = new User();
        this.user.roles = [];
        this.user.maxWeightSensitiveContent = 0;
        return this;
    }

    /**
     * Constrói e retorna a instância final de User
     * @returns Instância configurada de User
     */
    build(): User {
        // Validações básicas antes de construir
        if (!this.user.email) {
            throw new Error('UserBuilder: email é obrigatório');
        }
        if (!this.user.userName) {
            throw new Error('UserBuilder: userName é obrigatório');
        }
        if (!this.user.password) {
            throw new Error('UserBuilder: password é obrigatório');
        }

        return this.user;
    }

    /**
     * Constrói e retorna a instância sem validações
     * Útil para cenários de teste específicos onde campos podem estar incompletos
     */
    buildUnsafe(): User {
        return this.user;
    }
}
