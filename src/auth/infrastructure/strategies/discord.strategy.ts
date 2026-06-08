import { OAuthLoginUseCase } from '@auth/application/use-cases/oauth-login.use-case';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-discord';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
	constructor(
		private readonly configService: AppConfigService,
		private readonly oauthLoginUseCase: OAuthLoginUseCase,
	) {
		const config = configService.oauth.discord;
		super({
			clientID: config.clientId || 'disabled',
			clientSecret: config.clientSecret || 'disabled',
			callbackURL: config.callbackUrl,
			scope: ['identify', 'email'],
		});
	}

	async validate(
		accessToken: string,
		refreshToken: string,
		profile: Profile,
	) {
		const { id, email, username } = profile;
		if (!email) {
			throw new UnauthorizedException(
				'Discord account does not have an email',
			);
		}

		return this.oauthLoginUseCase.execute('discord', id, email, username);
	}
}
