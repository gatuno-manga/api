import { Inject, Injectable, Logger } from '@nestjs/common';
import { PasswordHasher } from './interfaces/password-hasher.interface';

/**
 * Serviço de criptografia de senha que implementa o padrão Strategy.
 *
 * Esta classe atua como um Context no padrão Strategy, delegando as operações
 * de hashing para uma implementação específica de PasswordHasher injetada.
 *
 * Benefícios do padrão Strategy:
 * - Desacoplamento: O código cliente não depende de implementações concretas
 * - Flexibilidade: Permite trocar algoritmos em tempo de execução ou configuração
 * - Testabilidade: Facilita a criação de mocks e testes unitários
 * - Manutenibilidade: Novos algoritmos podem ser adicionados sem modificar código existente
 * - Segurança: Migração para algoritmos mais seguros com impacto mínimo
 *
 * @example
 * ```typescript
 * // No módulo, você pode escolher a estratégia:
 * providers: [
 *   {
 *     provide: 'PASSWORD_HASHER',
 *     useClass: ScryptStrategy, // ou BcryptStrategy, Argon2Strategy
 *   },
 * ]
 * ```
 */
@Injectable()
export class PasswordEncryption {
	private readonly logger = new Logger(PasswordEncryption.name);

	constructor(
		@Inject('PASSWORD_HASHER') private readonly hasher: PasswordHasher,
	) {
		this.logger.log(`Usando algoritmo de hashing: ${this.hasher.algorithm}`);
	}

	/**
	 * Criptografa uma senha usando a estratégia configurada.
	 *
	 * @param password - Senha em texto plano
	 * @returns Promise com a senha hasheada
	 */
	async encrypt(password: string): Promise<string> {
		return this.hasher.hash(password);
	}

	/**
	 * Compara uma senha fornecida com um hash armazenado.
	 *
	 * @param storedPassword - Hash armazenado no banco de dados
	 * @param suppliedPassword - Senha em texto plano fornecida pelo usuário
	 * @returns Promise com true se a senha corresponder
	 */
	async compare(
		storedPassword: string,
		suppliedPassword: string,
	): Promise<boolean> {
		return this.hasher.compare(suppliedPassword, storedPassword);
	}

	/**
	 * Retorna o algoritmo de hashing atualmente em uso.
	 * Útil para logging e debugging.
	 */
	getAlgorithm(): string {
		return this.hasher.algorithm;
	}
}
