import { OAuthLoginUseCase } from '@auth/application/use-cases/oauth-login.use-case';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { Profile } from 'passport-google-oauth20';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import { GoogleStrategy } from './google.strategy';

describe('GoogleStrategy', () => {
	let strategy: GoogleStrategy;
	let oauthLoginUseCase: jest.Mocked<OAuthLoginUseCase>;
	let jwtService: jest.Mocked<JwtService>;

	beforeEach(async () => {
		const mockConfigService = {
			oauth: {
				google: {
					clientId: 'client-id',
					clientSecret: 'client-secret',
					callbackUrl: 'http://localhost/callback',
				},
			},
		};

		const mockOAuthLoginUseCase = {
			execute: jest.fn(),
		};

		const mockJwtService = {
			verify: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				GoogleStrategy,
				{
					provide: AppConfigService,
					useValue: mockConfigService,
				},
				{
					provide: OAuthLoginUseCase,
					useValue: mockOAuthLoginUseCase,
				},
				{
					provide: JwtService,
					useValue: mockJwtService,
				},
			],
		}).compile();

		strategy = module.get<GoogleStrategy>(GoogleStrategy);
		oauthLoginUseCase = module.get(OAuthLoginUseCase);
	});

	it('should validate and call oauthLoginUseCase', async () => {
		const profile = {
			id: 'google-123',
			displayName: 'Test User',
			emails: [{ value: 'test@example.com', verified: true }],
			provider: 'google',
			_raw: '',
			_json: {} as any,
		} as unknown as Profile;

		const user = { id: 'user-id' };
		oauthLoginUseCase.execute.mockResolvedValue(user as any);

		const req = { cookies: {} } as unknown as Request;
		const result = await strategy.validate(
			req,
			'access',
			'refresh',
			profile,
		);

		expect(oauthLoginUseCase.execute).toHaveBeenCalledWith(
			'google',
			'google-123',
			'test@example.com',
			'Test User',
			undefined,
		);
		expect(result).toEqual(user);
	});

	it('should throw UnauthorizedException if no email is provided', async () => {
		const profile = {
			id: 'google-123',
			displayName: 'Test User',
			provider: 'google',
			_raw: '',
			_json: {} as any,
		} as unknown as Profile;

		const req = { cookies: {} } as unknown as Request;
		await expect(
			strategy.validate(req, 'access', 'refresh', profile),
		).rejects.toThrow(UnauthorizedException);
	});
});
