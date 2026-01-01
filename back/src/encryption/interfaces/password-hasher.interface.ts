/**
 * Interface que define o contrato para estratégias de hashing de senha.
 * Implementa o padrão Strategy para permitir diferentes algoritmos de hashing
 * sem afetar o código cliente.
 *
 * @example
 * ```typescript
 * class BcryptStrategy implements PasswordHasher {
 *   async hash(password: string): Promise<string> {
 *     return bcrypt.hash(password, 10);
 *   }
 *
 *   async compare(password: string, hash: string): Promise<boolean> {
 *     return bcrypt.compare(password, hash);
 *   }
 * }
 * ```
 */
export interface PasswordHasher {
	/**
	 * Gera um hash criptográfico da senha fornecida.
	 *
	 * @param password - Senha em texto plano para ser hasheada
	 * @returns Promise com a senha hasheada (incluindo salt, se aplicável)
	 */
	hash(password: string): Promise<string>;

	/**
	 * Compara uma senha em texto plano com um hash armazenado.
	 *
	 * @param password - Senha em texto plano fornecida pelo usuário
	 * @param hash - Hash armazenado para comparação
	 * @returns Promise com true se a senha corresponder, false caso contrário
	 */
	compare(password: string, hash: string): Promise<boolean>;

	/**
	 * Nome identificador da estratégia de hashing.
	 * Útil para logging, debugging e migração entre algoritmos.
	 */
	readonly algorithm: string;
}
