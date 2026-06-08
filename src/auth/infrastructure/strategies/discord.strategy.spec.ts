import { OAuthLoginUseCase } from '@auth/application/use-cases/oauth-login.use-case';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Profile } from 'passport-discord';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import { DiscordStrategy } from './discord.strategy';

describe('DiscordStrategy', () => {
	let strategy: DiscordStrategy;
	let oauthLoginUseCase: jest.Mocked<OAuthLoginUseCase>;

	beforeEach(async () => {
		const mockConfigService = {
			oauth: {
				discord: {
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
				DiscordStrategy,
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

		strategy = module.get<DiscordStrategy>(DiscordStrategy);
		oauthLoginUseCase = module.get(OAuthLoginUseCase);
	});

	it('should validate and call oauthLoginUseCase', async () => {
		const profile: Profile = {
			id: 'discord-123',
			username: 'Test User',
			email: 'test@example.com',
			provider: 'discord',
			fetchedAt: new Date().toString(),
		} as Profile;

		const user = { id: 'user-id' };
		oauthLoginUseCase.execute.mockResolvedValue(user as any);

		const result = await strategy.validate('access', 'refresh', profile);

		expect(oauthLoginUseCase.execute).toHaveBeenCalledWith(
			'discord',
			'discord-123',
			'test@example.com',
			'Test User',
		);
		expect(result).toEqual(user);
	});

	it('should throw UnauthorizedException if no email is provided', async () => {
		const profile: Profile = {
			id: 'discord-123',
			username: 'Test User',
			provider: 'discord',
			fetchedAt: new Date().toString(),
		} as Profile;

		await expect(
			strategy.validate('access', 'refresh', profile),
		).rejects.toThrow(UnauthorizedException);
	});
});
