import { Test, type TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { RefreshTokenGuard } from './guard/jwt-refresh.guard';

describe('AuthController', () => {
	let controller: AuthController;
	let authService: AuthService;

	const mockAuthService = {
		login: jest.fn(),
		register: jest.fn(),
		refreshToken: jest.fn(),
		logout: jest.fn(),
		validateUser: jest.fn(),
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
