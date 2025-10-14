import { Test, TestingModule } from '@nestjs/testing';
import { PasswordEncryption } from './password-encryption.provider';
import { ScryptStrategy } from './strategies/scrypt.strategy';
import { BcryptStrategy } from './strategies/bcrypt.strategy';
import { AppConfigService } from 'src/app-config/app-config.service';

describe('PasswordEncryption com Strategy Pattern', () => {
    let service: PasswordEncryption;
    let strategy: ScryptStrategy;

    const mockConfig = {
        saltLength: 16,
        passwordKeyLength: 64,
    };

    beforeEach(async () => {
        strategy = new ScryptStrategy(mockConfig as any);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PasswordEncryption,
                {
                    provide: 'PASSWORD_HASHER',
                    useValue: strategy,
                },
            ],
        }).compile();

        service = module.get<PasswordEncryption>(PasswordEncryption);
    });

    describe('encrypt', () => {
        it('deve criptografar uma senha', async () => {
            const password = 'senhaSegura123';
            const hash = await service.encrypt(password);

            expect(hash).toBeDefined();
            expect(typeof hash).toBe('string');
            expect(hash.length).toBeGreaterThan(0);
        });

        it('deve gerar hashes diferentes para a mesma senha', async () => {
            const password = 'senhaSegura123';
            const hash1 = await service.encrypt(password);
            const hash2 = await service.encrypt(password);

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('compare', () => {
        it('deve retornar true para senha correta', async () => {
            const password = 'senhaSegura123';
            const hash = await service.encrypt(password);

            const result = await service.compare(hash, password);

            expect(result).toBe(true);
        });

        it('deve retornar false para senha incorreta', async () => {
            const password = 'senhaSegura123';
            const hash = await service.encrypt(password);

            const result = await service.compare(hash, 'senhaErrada');

            expect(result).toBe(false);
        });

        it('deve retornar false para hash inválido', async () => {
            const result = await service.compare('hashInvalido', 'qualquerSenha');

            expect(result).toBe(false);
        });
    });

    describe('getAlgorithm', () => {
        it('deve retornar o nome do algoritmo usado', () => {
            const algorithm = service.getAlgorithm();

            expect(algorithm).toBe('scrypt');
        });
    });
});

describe('PasswordHasher - Testes de Diferentes Estratégias', () => {
    const mockConfig = {
        saltLength: 16,
        passwordKeyLength: 64,
    };

    describe('ScryptStrategy', () => {
        let strategy: ScryptStrategy;

        beforeEach(() => {
            strategy = new ScryptStrategy(mockConfig as any);
        });

        it('deve ter o nome correto do algoritmo', () => {
            expect(strategy.algorithm).toBe('scrypt');
        });

        it('deve hashear e verificar senha corretamente', async () => {
            const password = 'teste123';
            const hash = await strategy.hash(password);

            expect(await strategy.compare(password, hash)).toBe(true);
            expect(await strategy.compare('senhaErrada', hash)).toBe(false);
        });

        it('deve gerar hash no formato correto (hash.salt)', async () => {
            const password = 'teste123';
            const hash = await strategy.hash(password);

            expect(hash).toContain('.');
            const parts = hash.split('.');
            expect(parts).toHaveLength(2);
            expect(parts[0].length).toBeGreaterThan(0); // hash
            expect(parts[1].length).toBeGreaterThan(0); // salt
        });
    });

    describe('BcryptStrategy', () => {
        let strategy: BcryptStrategy;

        beforeEach(() => {
            strategy = new BcryptStrategy();
        });

        it('deve ter o nome correto do algoritmo', () => {
            expect(strategy.algorithm).toBe('bcrypt');
        });

        it('deve hashear e verificar senha corretamente', async () => {
            const password = 'teste123';
            const hash = await strategy.hash(password);

            expect(await strategy.compare(password, hash)).toBe(true);
            expect(await strategy.compare('senhaErrada', hash)).toBe(false);
        });

        it('deve gerar hash no formato bcrypt', async () => {
            const password = 'teste123';
            const hash = await strategy.hash(password);

            // Hash bcrypt começa com $2a$, $2b$ ou $2y$
            expect(hash).toMatch(/^\$2[aby]\$/);
        });

        it('deve retornar false para hash inválido', async () => {
            const result = await strategy.compare('senha', 'hashInvalido');
            expect(result).toBe(false);
        });
    });

    // Nota: Testes do Argon2Strategy requerem a instalação do pacote 'argon2'
    // Descomente após instalar: npm install argon2
    /*
    describe('Argon2Strategy', () => {
        let strategy: Argon2Strategy;

        beforeEach(() => {
            strategy = new Argon2Strategy();
        });

        it('deve ter o nome correto do algoritmo', () => {
            expect(strategy.algorithm).toBe('argon2');
        });

        it('deve hashear e verificar senha corretamente', async () => {
            const password = 'teste123';
            const hash = await strategy.hash(password);

            expect(await strategy.compare(password, hash)).toBe(true);
            expect(await strategy.compare('senhaErrada', hash)).toBe(false);
        });

        it('deve gerar hash no formato argon2', async () => {
            const password = 'teste123';
            const hash = await strategy.hash(password);

            expect(hash).toMatch(/^\$argon2/);
        });
    });
    */
});

describe('PasswordEncryption - Troca de Estratégia', () => {
    it('deve permitir trocar de estratégia via DI', async () => {
        // Cria serviço com ScryptStrategy
        const scryptStrategy = new ScryptStrategy({
            saltLength: 16,
            passwordKeyLength: 64,
        } as any);

        const module1 = await Test.createTestingModule({
            providers: [
                PasswordEncryption,
                { provide: 'PASSWORD_HASHER', useValue: scryptStrategy },
            ],
        }).compile();

        const service1 = module1.get<PasswordEncryption>(PasswordEncryption);
        expect(service1.getAlgorithm()).toBe('scrypt');

        // Cria novo serviço com BcryptStrategy
        const bcryptStrategy = new BcryptStrategy();

        const module2 = await Test.createTestingModule({
            providers: [
                PasswordEncryption,
                { provide: 'PASSWORD_HASHER', useValue: bcryptStrategy },
            ],
        }).compile();

        const service2 = module2.get<PasswordEncryption>(PasswordEncryption);
        expect(service2.getAlgorithm()).toBe('bcrypt');
    });
});

describe('PasswordEncryption - Integração', () => {
    it('deve funcionar em cenário real de signup/signin', async () => {
        const strategy = new ScryptStrategy({
            saltLength: 16,
            passwordKeyLength: 64,
        } as any);

        const module = await Test.createTestingModule({
            providers: [
                PasswordEncryption,
                { provide: 'PASSWORD_HASHER', useValue: strategy },
            ],
        }).compile();

        const service = module.get<PasswordEncryption>(PasswordEncryption);

        // Simula signup
        const userPassword = 'senhaDoUsuario123';
        const hashedPassword = await service.encrypt(userPassword);

        // Simula armazenamento (em produção seria salvo no banco)
        const storedHash = hashedPassword;

        // Simula signin com senha correta
        const loginAttemptCorrect = await service.compare(
            storedHash,
            'senhaDoUsuario123',
        );
        expect(loginAttemptCorrect).toBe(true);

        // Simula signin com senha incorreta
        const loginAttemptWrong = await service.compare(
            storedHash,
            'senhaErrada',
        );
        expect(loginAttemptWrong).toBe(false);
    });
});
