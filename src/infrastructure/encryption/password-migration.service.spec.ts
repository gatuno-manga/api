import { Repository } from 'typeorm';
import { User } from 'src/users/infrastructure/database/entities/user.entity';
import { PasswordEncryption } from './password-encryption.provider';
import { PasswordMigrationService } from './password-migration.service';

describe('PasswordMigrationService', () => {
	let service: PasswordMigrationService;
	let userRepository: jest.Mocked<Repository<User>>;
	let passwordEncryption: jest.Mocked<PasswordEncryption>;

	beforeEach(() => {
		userRepository = {
			update: jest.fn(),
			find: jest.fn(),
		} as unknown as jest.Mocked<Repository<User>>;

		passwordEncryption = {
			encrypt: jest.fn(),
			compare: jest.fn(),
			getAlgorithm: jest.fn().mockReturnValue('scrypt'),
		} as unknown as jest.Mocked<PasswordEncryption>;

		service = new PasswordMigrationService(
			userRepository,
			passwordEncryption,
		);
	});

	it('deve considerar bcrypt como hash legado quando algoritmo atual eh scrypt', () => {
		passwordEncryption.getAlgorithm.mockReturnValue('scrypt');

		expect(service.isLegacyHash('$2b$10$abcdefghijklmnopqrstuv')).toBe(
			true,
		);
	});

	it('deve considerar hash atual como nao legado', () => {
		passwordEncryption.getAlgorithm.mockReturnValue('argon2');

		expect(
			service.isLegacyHash('$argon2id$v=19$m=65536,t=3,p=4$abc$def'),
		).toBe(false);
	});

	it('deve considerar hash desconhecido como legado', () => {
		expect(service.isLegacyHash('hash-formato-desconhecido')).toBe(true);
	});
});
