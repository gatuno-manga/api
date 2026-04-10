import { Test, type TestingModule } from '@nestjs/testing';
import { AppConfigService } from '../app-config/app-config.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { RefreshTokenGuard } from './guard/jwt-refresh.guard';
import { WebauthnService } from './services/webauthn.service';

describe('AuthController', () => {
	let controller: AuthController;
	let authService: AuthService;

	const mockAuthService = {
		signIn: jest.fn(),
		signUp: jest.fn(),
		refreshTokens: jest.fn(),
		logout: jest.fn(),
		logoutAll: jest.fn(),
		verifyMfaAndCompleteSignIn: jest.fn(),
		getMfaStatus: jest.fn(),
		beginTotpSetup: jest.fn(),
		verifyTotpSetup: jest.fn(),
		disableTotp: jest.fn(),
		listActiveSessions: jest.fn(),
		revokeSession: jest.fn(),
		revokeOtherSessions: jest.fn(),
		getAuditHistory: jest.fn(),
		generateTokensForUser: jest.fn(),
		completePasskeySignIn: jest.fn(),
	};

	const mockWebauthnService = {
		beginAuthentication: jest.fn(),
		verifyAuthentication: jest.fn(),
		listUserPasskeys: jest.fn(),
		beginRegistration: jest.fn(),
		verifyRegistration: jest.fn(),
		deleteUserPasskey: jest.fn(),
	};

	const mockGuard = {
		canActivate: jest.fn(() => true),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AuthController],
			providers: [
				{
					provide: AuthService,
					useValue: mockAuthService,
				},
				{
					provide: AppConfigService,
					useValue: {
						apiUrl: 'http://localhost:3000',
						refreshTokenTtl: 604800000,
					},
				},
				{
					provide: WebauthnService,
					useValue: mockWebauthnService,
				},
			],
		})
			.overrideGuard(JwtAuthGuard)
			.useValue(mockGuard)
			.overrideGuard(RefreshTokenGuard)
			.useValue(mockGuard)
			.compile();

		controller = module.get<AuthController>(AuthController);
		authService = module.get<AuthService>(AuthService);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	it('should have authService injected', () => {
		expect(authService).toBeDefined();
	});
});
