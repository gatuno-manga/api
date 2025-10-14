import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entitys/user.entity';
import { Role } from '../users/entitys/role.entity';
import { JwtService } from '@nestjs/jwt';
import { PasswordEncryption } from '../encryption/password-encryption.provider';
import { PasswordMigrationService } from '../encryption/password-migration.service';
import { DataEncryptionProvider } from '../encryption/data-encryption.provider';
import { AppConfigService } from '../app-config/app-config.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let roleRepository: any;
  let jwtService: any;
  let passwordEncryption: any;
  let passwordMigration: any;
  let dataEncryption: any;
  let appConfigService: any;
  let cacheManager: any;

  beforeEach(async () => {
    const mockUserRepository = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    const mockRoleRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
      signAsync: jest.fn(),
      verify: jest.fn(),
      decode: jest.fn(),
    };

    const mockPasswordEncryption = {
      encrypt: jest.fn(),
      compare: jest.fn(),
      getAlgorithm: jest.fn().mockReturnValue('scrypt'),
    };

    const mockPasswordMigration = {
      needsMigration: jest.fn(),
      migratePasswordOnLogin: jest.fn(),
    };

    const mockDataEncryption = {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
      compare: jest.fn(),
    };

    const mockAppConfigService = {
      jwtAccessSecret: 'test-access-secret',
      jwtRefreshSecret: 'test-refresh-secret',
      jwtAccessExpiration: '15m',
      jwtRefreshExpiration: '7d',
      refreshTokenTtl: 604800000,
      saltLength: 16,
      passwordKeyLength: 64,
    };

    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: PasswordEncryption,
          useValue: mockPasswordEncryption,
        },
        {
          provide: PasswordMigrationService,
          useValue: mockPasswordMigration,
        },
        {
          provide: DataEncryptionProvider,
          useValue: mockDataEncryption,
        },
        {
          provide: AppConfigService,
          useValue: mockAppConfigService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    roleRepository = module.get(getRepositoryToken(Role));
    jwtService = module.get<JwtService>(JwtService);
    passwordEncryption = module.get<PasswordEncryption>(PasswordEncryption);
    passwordMigration = module.get<PasswordMigrationService>(PasswordMigrationService);
    dataEncryption = module.get<DataEncryptionProvider>(DataEncryptionProvider);
    appConfigService = module.get<AppConfigService>(AppConfigService);
    cacheManager = module.get(CACHE_MANAGER);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have logger initialized', () => {
    expect(service['logger']).toBeDefined();
  });

  describe('getAlgorithm', () => {
    it('should return the active hashing algorithm', () => {
      expect(passwordEncryption.getAlgorithm()).toBe('scrypt');
    });
  });

  describe('signUp', () => {
    it('should create a new user successfully', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = 'hashed_password';
      const role = { id: '1', name: 'user' };
      const savedUser = { id: '123', email, userName: 'test', password: hashedPassword };
      const userWithRoles = { ...savedUser, roles: [role] };

      userRepository.findOneBy.mockResolvedValue(null);
      passwordEncryption.encrypt.mockResolvedValue(hashedPassword);
      roleRepository.findOne.mockResolvedValue(role);
      userRepository.save.mockResolvedValue(savedUser);
      userRepository.findOne.mockResolvedValue(userWithRoles);

      const result = await service.signUp(email, password);

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ email });
      expect(passwordEncryption.encrypt).toHaveBeenCalledWith(password);
      expect(roleRepository.findOne).toHaveBeenCalledWith({ where: { name: 'user' } });
      expect(userRepository.save).toHaveBeenCalled();
      expect(result).toEqual(userWithRoles);
    });

    it('should create admin user when isAdmin is true', async () => {
      const email = 'admin@example.com';
      const password = 'admin123';
      const role = { id: '1', name: 'admin' };

      userRepository.findOneBy.mockResolvedValue(null);
      passwordEncryption.encrypt.mockResolvedValue('hashed');
      roleRepository.findOne.mockResolvedValue(role);
      userRepository.save.mockResolvedValue({ id: '1', email });
      userRepository.findOne.mockResolvedValue({ id: '1', email, roles: [role] });

      await service.signUp(email, password, true);

      expect(roleRepository.findOne).toHaveBeenCalledWith({ where: { name: 'admin' } });
    });

    it('should throw BadRequestException if user already exists', async () => {
      const email = 'existing@example.com';
      userRepository.findOneBy.mockResolvedValue({ id: '1', email });

      await expect(service.signUp(email, 'password')).rejects.toThrow(BadRequestException);
      await expect(service.signUp(email, 'password')).rejects.toThrow('User already exists');
    });

    it('should throw BadRequestException if role not found', async () => {
      userRepository.findOneBy.mockResolvedValue(null);
      passwordEncryption.encrypt.mockResolvedValue('hashed');
      roleRepository.findOne.mockResolvedValue(null);

      await expect(service.signUp('test@example.com', 'password')).rejects.toThrow(BadRequestException);
    });
  });

  describe('signIn', () => {
    it('should sign in user successfully', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const user = {
        id: '123',
        email,
        password: 'hashed_password',
        roles: [{ id: '1', name: 'user' }],
      };
      const tokens = { accessToken: 'access_token', refreshToken: 'refresh_token' };

      userRepository.findOne.mockResolvedValue(user);
      passwordEncryption.compare.mockResolvedValue(true);
      passwordMigration.migratePasswordOnLogin.mockResolvedValue(false);
      jwtService.signAsync.mockResolvedValueOnce('access_token').mockResolvedValueOnce('refresh_token');
      dataEncryption.encrypt.mockResolvedValue('encrypted_token');
      cacheManager.get.mockResolvedValue([]);
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.signIn(email, password);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email },
        relations: ['roles'],
        select: ['id', 'email', 'password', 'roles'],
      });
      expect(passwordEncryption.compare).toHaveBeenCalledWith(user.password, password);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.signIn('test@example.com', 'password')).rejects.toThrow(UnauthorizedException);
      await expect(service.signIn('test@example.com', 'password')).rejects.toThrow('User not exists');
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      const user = { id: '1', email: 'test@example.com', password: 'hashed', roles: [] };
      userRepository.findOne.mockResolvedValue(user);
      passwordEncryption.compare.mockResolvedValue(false);

      await expect(service.signIn('test@example.com', 'wrong_password')).rejects.toThrow(UnauthorizedException);
      await expect(service.signIn('test@example.com', 'wrong_password')).rejects.toThrow('Invalid password');
    });

    it('should migrate password if needed', async () => {
      const user = {
        id: '123',
        email: 'test@example.com',
        password: 'old_hash',
        roles: [{ id: '1', name: 'user' }],
      };

      userRepository.findOne.mockResolvedValue(user);
      passwordEncryption.compare.mockResolvedValue(true);
      passwordMigration.migratePasswordOnLogin.mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('token');
      dataEncryption.encrypt.mockResolvedValue('encrypted');
      cacheManager.get.mockResolvedValue([]);

      await service.signIn(user.email, 'password');

      expect(passwordMigration.migratePasswordOnLogin).toHaveBeenCalledWith(user, 'password');
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const userId = 'user123';
      const refreshToken = 'refresh_token';
      const storedTokens = [
        { hash: 'hashed_token', expiresAt: Date.now() + 100000 },
      ];

      cacheManager.get.mockResolvedValue(storedTokens);
      dataEncryption.compare.mockResolvedValue(true);
      cacheManager.del.mockResolvedValue(undefined);

      const result = await service.logout(userId, refreshToken);

      expect(cacheManager.get).toHaveBeenCalledWith(`user-tokens:${userId}`);
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('should throw UnauthorizedException if no refresh token provided', async () => {
      await expect(service.logout('user123', '')).rejects.toThrow(UnauthorizedException);
      await expect(service.logout('user123', '')).rejects.toThrow('Refresh token is required');
    });

    it('should throw UnauthorizedException if no active sessions', async () => {
      cacheManager.get.mockResolvedValue([]);

      await expect(service.logout('user123', 'token')).rejects.toThrow(UnauthorizedException);
      await expect(service.logout('user123', 'token')).rejects.toThrow('No active sessions found');
    });

    it('should throw UnauthorizedException if token not found in cache', async () => {
      const storedTokens = [{ hash: 'different_hash', expiresAt: Date.now() + 100000 }];
      cacheManager.get.mockResolvedValue(storedTokens);
      dataEncryption.compare.mockResolvedValue(false);

      await expect(service.logout('user123', 'invalid_token')).rejects.toThrow(UnauthorizedException);
      await expect(service.logout('user123', 'invalid_token')).rejects.toThrow('Invalid token');
    });

    it('should keep other tokens when logging out one session', async () => {
      const userId = 'user123';
      const storedTokens = [
        { hash: 'token1', expiresAt: Date.now() + 100000 },
        { hash: 'token2', expiresAt: Date.now() + 200000 },
      ];

      cacheManager.get.mockResolvedValue(storedTokens);
      dataEncryption.compare.mockResolvedValueOnce(true);
      cacheManager.set.mockResolvedValue(undefined);

      await service.logout(userId, 'refresh_token');

      expect(cacheManager.set).toHaveBeenCalled();
      const setCalls = cacheManager.set.mock.calls;
      expect(setCalls[0][1]).toHaveLength(1);
    });
  });

  describe('logoutAll', () => {
    it('should logout all sessions successfully', async () => {
      const userId = 'user123';
      const storedTokens = [
        { hash: 'token1', expiresAt: Date.now() + 100000 },
        { hash: 'token2', expiresAt: Date.now() + 200000 },
      ];

      cacheManager.get.mockResolvedValue(storedTokens);
      cacheManager.del.mockResolvedValue(undefined);

      const result = await service.logoutAll(userId);

      expect(cacheManager.del).toHaveBeenCalledWith(`user-tokens:${userId}`);
      expect(result).toEqual({ message: 'All sessions logged out successfully' });
    });

    it('should throw UnauthorizedException if no active sessions', async () => {
      cacheManager.get.mockResolvedValue([]);

      await expect(service.logoutAll('user123')).rejects.toThrow(UnauthorizedException);
      await expect(service.logoutAll('user123')).rejects.toThrow('No active sessions found');
    });

    it('should filter expired tokens before checking', async () => {
      const expiredTokens = [
        { hash: 'token1', expiresAt: Date.now() - 1000 },
      ];

      cacheManager.get.mockResolvedValue(expiredTokens);

      await expect(service.logoutAll('user123')).rejects.toThrow('No active sessions found');
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      const userId = 'user123';
      const oldRefreshToken = 'old_refresh_token';
      const user = {
        id: userId,
        email: 'test@example.com',
        roles: [{ id: '1', name: 'user' }],
      };
      const storedTokens = [
        { hash: 'hashed_token', expiresAt: Date.now() + 100000 },
      ];

      cacheManager.get.mockResolvedValue(storedTokens);
      dataEncryption.compare.mockResolvedValue(true);
      userRepository.findOne.mockResolvedValue(user);
      jwtService.signAsync.mockResolvedValueOnce('new_access').mockResolvedValueOnce('new_refresh');
      dataEncryption.encrypt.mockResolvedValue('new_hashed_token');
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.refreshTokens(userId, oldRefreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(cacheManager.set).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if no refresh token provided', async () => {
      await expect(service.refreshTokens('user123', '')).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshTokens('user123', '')).rejects.toThrow('Refresh token is required');
    });

    it('should throw UnauthorizedException if no valid session found', async () => {
      cacheManager.get.mockResolvedValue([]);

      await expect(service.refreshTokens('user123', 'token')).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshTokens('user123', 'token')).rejects.toThrow('No valid session found');
    });

    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      const storedTokens = [{ hash: 'hashed', expiresAt: Date.now() + 100000 }];
      cacheManager.get.mockResolvedValue(storedTokens);
      dataEncryption.compare.mockResolvedValue(false);

      await expect(service.refreshTokens('user123', 'invalid_token')).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshTokens('user123', 'invalid_token')).rejects.toThrow('Invalid refresh token');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const storedTokens = [{ hash: 'hashed', expiresAt: Date.now() + 100000 }];
      cacheManager.get.mockResolvedValue(storedTokens);
      dataEncryption.compare.mockResolvedValue(true);
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.refreshTokens('user123', 'token')).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshTokens('user123', 'token')).rejects.toThrow('User not found');
    });

    it('should remove old token and add new token', async () => {
      const userId = 'user123';
      const storedTokens = [
        { hash: 'old_token', expiresAt: Date.now() + 100000 },
        { hash: 'another_token', expiresAt: Date.now() + 200000 },
      ];
      const user = { id: userId, email: 'test@example.com', roles: [{ id: '1', name: 'user' }] };

      cacheManager.get.mockResolvedValue(storedTokens);
      dataEncryption.compare.mockResolvedValueOnce(true);
      userRepository.findOne.mockResolvedValue(user);
      jwtService.signAsync.mockResolvedValue('token');
      dataEncryption.encrypt.mockResolvedValue('new_hashed');

      await service.refreshTokens(userId, 'old_refresh');

      const setCalls = cacheManager.set.mock.calls;
      expect(setCalls[0][1]).toHaveLength(2); // Removed 1, added 1
    });
  });
});
