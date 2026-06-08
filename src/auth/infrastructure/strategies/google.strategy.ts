import { OAuthLoginUseCase } from '@auth/application/use-cases/oauth-login.use-case';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
	constructor(
		private readonly configService: AppConfigService,
		private readonly oauthLoginUseCase: OAuthLoginUseCase,
	) {
		const config = configService.oauth.google;
		super({
			clientID: config.clientId || 'disabled',
			clientSecret: config.clientSecret || 'disabled',
			callbackURL: config.callbackUrl,
			scope: ['email', 'profile'],
		});
	}

	async validate(
		accessToken: string,
		refreshToken: string,
		profile: Profile,
	) {
		const { id, emails, displayName } = profile;
		if (!emails || !emails[0]?.value) {
			throw new UnauthorizedException(
				'Google account does not have an email',
			);
		}

		return this.oauthLoginUseCase.execute(
			'google',
			id,
			emails[0].value,
			displayName,
		);
	}
}
