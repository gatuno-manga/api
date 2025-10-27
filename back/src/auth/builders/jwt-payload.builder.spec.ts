import { JwtPayloadBuilder } from './jwt-payload.builder';
import { User } from '../../users/entitys/user.entity';
import { Role } from '../../users/entitys/role.entity';

describe('JwtPayloadBuilder', () => {
    let builder: JwtPayloadBuilder;

    beforeEach(() => {
        builder = new JwtPayloadBuilder();
    });

    describe('build with required fields only', () => {
        it('should build a valid payload with all required fields', () => {
            const payload = builder
                .setSubject('user-123')
                .setIssuer('login')
                .setEmail('user@example.com')
                .setRoles(['user'])
                .setMaxWeightSensitiveContent(3)
                .build();

            expect(payload).toEqual({
                sub: 'user-123',
                iss: 'login',
                email: 'user@example.com',
                roles: ['user'],
                maxWeightSensitiveContent: 3,
            });
        });

        it('should throw error when subject is missing', () => {
            expect(() => {
                builder
                    .setIssuer('login')
                    .setEmail('user@example.com')
                    .setRoles(['user'])
                    .setMaxWeightSensitiveContent(3)
                    .build();
            }).toThrow('Subject (sub) is required');
        });

        it('should throw error when issuer is missing', () => {
            expect(() => {
                builder
                    .setSubject('user-123')
                    .setEmail('user@example.com')
                    .setRoles(['user'])
                    .setMaxWeightSensitiveContent(3)
                    .build();
            }).toThrow('Issuer (iss) is required');
        });

        it('should throw error when roles are missing', () => {
            expect(() => {
                builder
                    .setSubject('user-123')
                    .setIssuer('login')
                    .setEmail('user@example.com')
                    .setMaxWeightSensitiveContent(3)
                    .build();
            }).toThrow('At least one role is required');
        });
    });

    describe('build with optional fields', () => {
        it('should build payload with session id', () => {
            const payload = builder
                .setSubject('user-123')
                .setIssuer('login')
                .setEmail('user@example.com')
                .setRoles(['user'])
                .setMaxWeightSensitiveContent(3)
                .setSessionId('session-abc-123')
                .build();

            expect(payload.sessionId).toBe('session-abc-123');
        });

        it('should build payload with IP address and user agent', () => {
            const payload = builder
                .setSubject('user-123')
                .setIssuer('login')
                .setEmail('user@example.com')
                .setRoles(['user'])
                .setMaxWeightSensitiveContent(3)
                .setIpAddress('192.168.1.100')
                .setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
                .build();

            expect(payload.ipAddress).toBe('192.168.1.100');
            expect(payload.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
        });

        it('should build payload with timestamps', () => {
            const iat = Math.floor(Date.now() / 1000);
            const exp = iat + 3600;

            const payload = builder
                .setSubject('user-123')
                .setIssuer('login')
                .setEmail('user@example.com')
                .setRoles(['user'])
                .setMaxWeightSensitiveContent(3)
                .setIssuedAt(iat)
                .setExpiresAt(exp)
                .build();

            expect(payload.iat).toBe(iat);
            expect(payload.exp).toBe(exp);
        });

        it('should build payload with permissions', () => {
            const payload = builder
                .setSubject('user-123')
                .setIssuer('login')
                .setEmail('user@example.com')
                .setRoles(['admin'])
                .setMaxWeightSensitiveContent(5)
                .setPermissions(['read:books', 'write:books', 'delete:books'])
                .build();

            expect(payload.permissions).toEqual(['read:books', 'write:books', 'delete:books']);
        });

        it('should add individual permissions', () => {
            const payload = builder
                .setSubject('user-123')
                .setIssuer('login')
                .setEmail('user@example.com')
                .setRoles(['admin'])
                .setMaxWeightSensitiveContent(5)
                .addPermission('read:books')
                .addPermission('write:books')
                .build();

            expect(payload.permissions).toEqual(['read:books', 'write:books']);
        });

        it('should build payload with custom claims', () => {
            const payload = builder
                .setSubject('user-123')
                .setIssuer('login')
                .setEmail('user@example.com')
                .setRoles(['user'])
                .setMaxWeightSensitiveContent(3)
                .setCustomClaims({
                    department: 'Engineering',
                    tenantId: 'tenant-456',
                })
                .build();

            expect(payload.customClaims).toEqual({
                department: 'Engineering',
                tenantId: 'tenant-456',
            });
        });

        it('should add individual custom claims', () => {
            const payload = builder
                .setSubject('user-123')
                .setIssuer('login')
                .setEmail('user@example.com')
                .setRoles(['user'])
                .setMaxWeightSensitiveContent(3)
                .addCustomClaim('department', 'Engineering')
                .addCustomClaim('tenantId', 'tenant-456')
                .build();

            expect(payload.customClaims).toEqual({
                department: 'Engineering',
                tenantId: 'tenant-456',
            });
        });
    });

    describe('fromUser method', () => {
        it('should build payload from User entity', () => {
            const role1 = new Role();
            role1.name = 'admin';
            role1.maxWeightSensitiveContent = 5;

            const role2 = new Role();
            role2.name = 'moderator';
            role2.maxWeightSensitiveContent = 3;

            const user = new User();
            user.id = 'user-123';
            user.email = 'admin@example.com';
            user.roles = [role1, role2];

            const payload = builder
                .fromUser(user)
                .setIssuer('login')
                .build();

            expect(payload.sub).toBe('user-123');
            expect(payload.email).toBe('admin@example.com');
            expect(payload.roles).toEqual(['admin', 'moderator']);
            expect(payload.maxWeightSensitiveContent).toBe(5); // Máximo entre 5 e 3
        });

        it('should throw error when user has no roles', () => {
            const user = new User();
            user.id = 'user-123';
            user.email = 'user@example.com';
            user.roles = [];

            expect(() => {
                builder.fromUser(user);
            }).toThrow('User must have at least one role assigned');
        });

        it('should allow adding optional fields after fromUser', () => {
            const role = new Role();
            role.name = 'user';
            role.maxWeightSensitiveContent = 3;

            const user = new User();
            user.id = 'user-123';
            user.email = 'user@example.com';
            user.roles = [role];

            const payload = builder
                .fromUser(user)
                .setIssuer('login')
                .setSessionId('session-abc')
                .addPermission('read:books')
                .addCustomClaim('tenantId', 'tenant-123')
                .build();

            expect(payload.sub).toBe('user-123');
            expect(payload.sessionId).toBe('session-abc');
            expect(payload.permissions).toEqual(['read:books']);
            expect(payload.customClaims).toEqual({ tenantId: 'tenant-123' });
        });
    });

    describe('reset method', () => {
        it('should reset builder to build a new payload', () => {
            builder
                .setSubject('user-123')
                .setIssuer('login')
                .setEmail('user@example.com')
                .setRoles(['user'])
                .setMaxWeightSensitiveContent(3)
                .build();

            const payload = builder
                .reset()
                .setSubject('user-456')
                .setIssuer('refresh')
                .setEmail('another@example.com')
                .setRoles(['admin'])
                .setMaxWeightSensitiveContent(5)
                .build();

            expect(payload.sub).toBe('user-456');
            expect(payload.iss).toBe('refresh');
            expect(payload.email).toBe('another@example.com');
        });
    });

    describe('complex payload scenarios', () => {
        it('should build a complete payload with all fields', () => {
            const role = new Role();
            role.name = 'admin';
            role.maxWeightSensitiveContent = 5;

            const user = new User();
            user.id = 'user-123';
            user.email = 'admin@example.com';
            user.roles = [role];

            const iat = Math.floor(Date.now() / 1000);
            const exp = iat + 3600;

            const payload = builder
                .fromUser(user)
                .setIssuer('login')
                .setIssuedAt(iat)
                .setExpiresAt(exp)
                .setSessionId('session-xyz-789')
                .setIpAddress('10.0.0.1')
                .setUserAgent('Mozilla/5.0')
                .addPermission('read:*')
                .addPermission('write:*')
                .addPermission('delete:*')
                .addCustomClaim('tenantId', 'tenant-001')
                .addCustomClaim('department', 'IT')
                .addCustomClaim('region', 'US-West')
                .build();

            expect(payload).toMatchObject({
                sub: 'user-123',
                iss: 'login',
                email: 'admin@example.com',
                roles: ['admin'],
                maxWeightSensitiveContent: 5,
                iat,
                exp,
                sessionId: 'session-xyz-789',
                ipAddress: '10.0.0.1',
                userAgent: 'Mozilla/5.0',
                permissions: ['read:*', 'write:*', 'delete:*'],
                customClaims: {
                    tenantId: 'tenant-001',
                    department: 'IT',
                    region: 'US-West',
                },
            });
        });
    });
});
