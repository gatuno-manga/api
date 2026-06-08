import { OAuthLoginUseCase } from '@auth/application/use-cases/oauth-login.use-case';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Profile } from 'passport-github2';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import { GithubStrategy } from './github.strategy';

describe('GithubStrategy', () => {
	let strategy: GithubStrategy;
	let oauthLoginUseCase: jest.Mocked<OAuthLoginUseCase>;

	beforeEach(async () => {
		const mockConfigService = {
			oauth: {
				github: {
					clientId: 'client-id',
					clientSecret: 'client-secret',
					callbackUrl: 'http://localhost/callback',
				},
			},
		};

		const mockOAuthLoginUseCase = {
			execute: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				GithubStrategy,
				{
					provide: AppConfigService,
					useValue: mockConfigService,
				},
				{
					provide: OAuthLoginUseCase,
					useValue: mockOAuthLoginUseCase,
				},
			],
		}).compile();

		strategy = module.get<GithubStrategy>(GithubStrategy);
		oauthLoginUseCase = module.get(OAuthLoginUseCase);
	});

	it('should validate and call oauthLoginUseCase', async () => {
		const profile: Profile = {
			id: 'github-123',
			displayName: 'Test User',
			username: 'testuser',
			emails: [{ value: 'test@example.com' }],
			provider: 'github',
		} as Profile;

		const user = { id: 'user-id' };
		oauthLoginUseCase.execute.mockResolvedValue(user as any);

		const result = await strategy.validate('access', 'refresh', profile);

		expect(oauthLoginUseCase.execute).toHaveBeenCalledWith(
			'github',
			'github-123',
			'test@example.com',
			'Test User',
		);
		expect(result).toEqual(user);
	});

	it('should throw UnauthorizedException if no email is provided', async () => {
		const profile: Profile = {
			id: 'github-123',
			username: 'testuser',
			provider: 'github',
		} as Profile;

		await expect(
			strategy.validate('access', 'refresh', profile),
		).rejects.toThrow(UnauthorizedException);
	});
});
